/**
 * Save the editor document as a flattened PDF (decision D2 = A).
 *
 * The original bytes are the single source of truth: every save rebuilds the file from them, so a
 * second save can never stack annotations twice. Pages are copied in `doc.pages` order, the user
 * rotation is added on top of the file's own /Rotate, and overlay objects are *painted* (not turned
 * into `/Annots`), which is what "flatten" means here.
 *
 * Layer rule: no React, no pdfjs. Only the model types, the pdf-lib pipeline, the shared drawing
 * helpers and `drawObject` (one branch per object kind), so the round-trip test runs in plain jsdom.
 */

import { PDFDocument, StandardFonts, degrees, type PDFPage } from '@cantoo/pdf-lib';
import type { ToolResult } from '@/core/types';
import { normalizePageRotation } from '@/core/pdf/draw';
import { loadPdfFromBytes } from '@/core/pdf/load';
import { needsUnicodeFont } from '@/core/pdf/text';
import { visiblePages } from '../model/doc';
import { sortByZ } from '../model/objects';
import type { PdfEditorDoc, PdfPageState } from '../model/types';
import { drawPageObjects, embedImageDataUrl, type FontSet } from './drawObject';

export interface FlattenOptions {
  /**
   * Only `'flatten'` exists in P0. Any other value is rejected instead of silently downgrading, so a
   * future mode (annotations / encrypted) cannot ship half-implemented.
   */
  mode?: 'flatten';
}

export interface FlattenResult {
  bytes: Uint8Array;
  filename: string;
  /** True when at least one text object was written as an image (CJK / emoji) */
  rasterized: boolean;
}

export type TextRenderMode = 'font' | 'raster';

/**
 * StandardFonts are WinAnsi-only, so anything above U+00FF has to be rasterized.
 *
 * Exposed as a pure function: the decision is unit-testable in jsdom, while the rasterization itself
 * needs a canvas 2d context and is therefore covered by e2e / manual checks.
 */
export function textRenderMode(text: string): TextRenderMode {
  return needsUnicodeFont(text) ? 'raster' : 'font';
}

/** `report.pdf` → `report-edited.pdf` (keeps the user's name, never overwrites the original) */
export function editedFilename(name: string): string {
  const base = name.replace(/\.pdf$/i, '').trim() || 'document';
  return `${base}-edited.pdf`;
}

async function embedFonts(out: PDFDocument): Promise<FontSet> {
  const [regular, bold, italic, boldItalic] = await Promise.all([
    out.embedFont(StandardFonts.Helvetica),
    out.embedFont(StandardFonts.HelveticaBold),
    out.embedFont(StandardFonts.HelveticaOblique),
    out.embedFont(StandardFonts.HelveticaBoldOblique),
  ]);
  return { regular, bold, italic, boldItalic };
}

/** Output rotation = the file's own /Rotate plus the editor's rotation */
export function outputRotation(state: PdfPageState, baseRotation: number): number {
  return normalizePageRotation(baseRotation + state.rotation);
}

/**
 * Rebuild and flatten the document.
 *
 * Returns the bytes instead of downloading them: the caller decides when a save counts (mark the
 * document saved, show a toast) and the test can assert on the PDF without touching the DOM.
 */
export async function flattenPdf(
  doc: PdfEditorDoc,
  opts?: FlattenOptions,
): Promise<ToolResult<FlattenResult>> {
  if (opts?.mode && opts.mode !== 'flatten') {
    // TODO(M4/P1): annotation-preserving and encrypted output modes
    return { ok: false, error: 'PROCESS_FAILED' };
  }

  const pages = visiblePages(doc);
  if (pages.length === 0 || doc.source.bytes.length === 0) {
    return { ok: false, error: 'NO_PAGES' };
  }

  const source = await loadPdfFromBytes(doc.source.bytes, { password: doc.source.password });
  if (!source.ok) return source;

  try {
    const out = await PDFDocument.create();
    const fonts = await embedFonts(out);
    const objects = sortByZ(doc.objects);
    let rasterized = false;

    // Every save rebuilds from bytes, so each source (main + attachments) is loaded once
    const loaded = new Map<string, PDFDocument>([[doc.source.key, source.value]]);
    for (const attachment of doc.attachments) {
      const result = await loadPdfFromBytes(attachment.bytes, {
        password: attachment.password,
      });
      if (!result.ok) return result;
      loaded.set(attachment.key, result.value);
    }

    for (const state of pages) {
      const page =
        state.blank !== undefined
          ? out.addPage([state.blank.widthPt, state.blank.heightPt])
          : await copySourcePage(out, loaded, state);
      if (!page) return { ok: false, error: 'INVALID_RANGE' };

      const baseRotation = normalizePageRotation(page.getRotation().angle);
      const rotation = outputRotation(state, baseRotation);
      if (rotation !== baseRotation) page.setRotation(degrees(rotation));

      const pageObjects = objects.filter((object) => object.page === state.id);
      const painted = await drawPageObjects(
        {
          out,
          page,
          fonts,
          embedImage: (dataUrl) => embedImageDataUrl(out, dataUrl),
        },
        pageObjects,
      );
      if (painted.rasterized) rasterized = true;
    }

    const title = doc.meta.title?.trim();
    if (title) out.setTitle(title);
    if (doc.meta.author) out.setAuthor(doc.meta.author);
    if (doc.meta.subject) out.setSubject(doc.meta.subject);
    if (doc.meta.keywords) out.setKeywords(doc.meta.keywords.split(/[,;]/).map((s) => s.trim()));
    // pdf-lib rewrites /Producer on save (updateInfoDict), so /Creator is the field that keeps our
    // brand; both are set for tools that only read one of them.
    out.setProducer('SynTools');
    out.setCreator('SynTools');

    const bytes = await out.save({ useObjectStreams: true });
    return { ok: true, value: { bytes, filename: editedFilename(doc.name), rasterized } };
  } catch {
    // Never hand back a half-written file
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}

/** Copy one source page into the output document; `null` when the source or index is missing */
async function copySourcePage(
  out: PDFDocument,
  loaded: Map<string, PDFDocument>,
  state: PdfPageState,
): Promise<PDFPage | null> {
  const owner = loaded.get(state.sourceKey);
  if (!owner) return null;
  const [copied] = await out.copyPages(owner, [state.sourceIndex]);
  if (!copied) return null;
  out.addPage(copied);
  return copied;
}
