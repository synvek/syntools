/**
 * PDF → Word export (M4-3).
 *
 * Three modes, one honest trade-off each:
 * - `text`: rebuild paragraphs from the text layer. Editable, smallest file, but annotations and
 *   text patches are *not* included (the patch is a white box over the original glyphs, which the
 *   text layer still contains).
 * - `raster`: flatten the editor document, then render every page at 150 DPI. Pixel-faithful,
 *   not editable.
 * - `mixed`: text where a text layer exists, raster for scanned pages. The recommended default.
 *
 * Page order follows the editor document (reordering, deletions, inserted blank pages), not the
 * source file.
 */

import { createFidelityReport, type FidelityIssue, type FidelityReport } from '@/core/fidelity';
import { exportHtmlToDocx } from '@/core/docx';
import { openPdfjsDoc, renderPageDataUrl } from '@/core/pdf/render';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ToolResult } from '@/core/types';
import { visiblePages } from '../model/doc';
import type { PdfEditorDoc } from '../model/types';
import { exportBaseName } from './exportImages';
import { extractPageStructure } from './pdfStructure';
import { flattenPdf } from './savePdf';

export type DocxExportMode = 'text' | 'raster' | 'mixed';

export interface DocxExportRequest {
  mode: DocxExportMode;
  /** 1-based pages in document order; empty means every page */
  pageNumbers?: number[];
  /** File name in the header, page numbers in the footer */
  headerFooter?: boolean;
}

export interface DocxExportResult {
  bytes: Uint8Array;
  filename: string;
  report: FidelityReport;
  pageCount: number;
  textPages: number;
  imagePages: number;
}

/** JPEG at 150 DPI keeps a 12-page scan under ~2 MB while staying legible when printed */
const RASTER_DPI = 150;
const RASTER_QUALITY = 0.9;

export function docxFileName(docName: string): string {
  return `${exportBaseName(docName)}.docx`;
}

/**
 * Decide, per page, whether to rebuild text or embed an image.
 *
 * Pure so the mode matrix is testable without pdfjs:
 * - `text` never rasterizes (pages without text are reported as a loss);
 * - `raster` always embeds;
 * - `mixed` embeds only pages with no text layer (scans).
 */
export function chooseDocxPageModes(
  mode: DocxExportMode,
  textLineCounts: readonly number[],
): Array<'text' | 'image'> {
  if (mode === 'raster') return textLineCounts.map(() => 'image');
  if (mode === 'text') return textLineCounts.map(() => 'text');
  return textLineCounts.map((count) => (count > 0 ? 'text' : 'image'));
}

/** Join page HTML with `<hr>`, which the core docx writer maps to a page break */
export function joinDocxPages(pages: readonly string[]): string {
  return pages.join('\n<hr>\n');
}

export function imagePageHtml(src: string, width: number, height: number): string {
  // Width/height are CSS pixels at the render DPI; core/docx scales them into the text column
  return `<p><img src="${src}" width="${Math.round(width)}" height="${Math.round(height)}" alt=""></p>`;
}

interface SelectedPage {
  /** 1-based page number in the editor document, also the flattened page index */
  docIndex: number;
  /** 1-based page number in the source PDF; `undefined` for blank / attachment pages */
  sourceIndex?: number;
  pageId: string;
}

function selectPages(doc: PdfEditorDoc, pageNumbers?: readonly number[]): SelectedPage[] {
  const pages = visiblePages(doc);
  const requested =
    pageNumbers && pageNumbers.length > 0 ? pageNumbers : pages.map((_, index) => index + 1);

  const selected: SelectedPage[] = [];
  for (const pageNumber of requested) {
    const page = pages[pageNumber - 1];
    if (!page) continue;
    selected.push({
      docIndex: pageNumber,
      sourceIndex: !page.blank && page.sourceKey === 'main' ? page.sourceIndex + 1 : undefined,
      pageId: page.id,
    });
  }
  return selected;
}

/** Render one flattened page and return its HTML block */
async function renderImagePage(
  proxy: PDFDocumentProxy,
  docIndex: number,
): Promise<ToolResult<string>> {
  const scale = RASTER_DPI / 72;
  const rendered = await renderPageDataUrl(proxy, docIndex, scale, 'image/jpeg', RASTER_QUALITY);
  if (!rendered.ok) return rendered;

  try {
    const page = await proxy.getPage(docIndex);
    const viewport = page.getViewport({ scale });
    return { ok: true, value: imagePageHtml(rendered.value, viewport.width, viewport.height) };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}

/**
 * Build the Word file. Text extraction uses the *original* proxy (annotations are not in its text
 * layer), while rasterization uses a flattened copy so every edit is baked in.
 */
export async function exportPdfToDocx(
  pdfDoc: PDFDocumentProxy,
  doc: PdfEditorDoc,
  request: DocxExportRequest,
): Promise<ToolResult<DocxExportResult>> {
  const selected = selectPages(doc, request.pageNumbers);
  if (selected.length === 0) return { ok: false, error: 'NO_PAGES' };

  // 1. Read the text layer of every source page (cheap; skipped for blank/attachment pages)
  const textPages: Array<{ html: string; lineCount: number; hasText: boolean }> = [];
  for (const page of selected) {
    if (page.sourceIndex === undefined) {
      textPages.push({ html: '', lineCount: 0, hasText: false });
      continue;
    }
    try {
      const structure = await extractPageStructure(pdfDoc, page.sourceIndex);
      textPages.push({
        html: structure.html,
        lineCount: structure.lineCount,
        hasText: structure.lineCount > 0,
      });
    } catch {
      textPages.push({ html: '', lineCount: 0, hasText: false });
    }
  }

  const modes = chooseDocxPageModes(
    request.mode,
    textPages.map((page) => page.lineCount),
  );

  // 2. Only pay for flattening when at least one page needs an image
  let rasterDoc: PDFDocumentProxy | null = null;
  if (modes.includes('image')) {
    const flattened = await flattenPdf(doc);
    if (!flattened.ok) return flattened;
    const opened = await openPdfjsDoc(flattened.value.bytes);
    if (!opened.ok) return opened;
    rasterDoc = opened.value;
  }

  // 3. Build one HTML fragment per page
  const pageHtml: string[] = [];
  const emptyTextPages: number[] = [];
  let imagePages = 0;
  let textPageCount = 0;

  for (let index = 0; index < selected.length; index += 1) {
    const page = selected[index];
    const mode = modes[index];
    if (mode === 'image' && rasterDoc) {
      const rendered = await renderImagePage(rasterDoc, page.docIndex);
      if (!rendered.ok) return rendered;
      pageHtml.push(rendered.value);
      imagePages += 1;
      continue;
    }

    const text = textPages[index];
    if (!text.hasText) {
      emptyTextPages.push(page.docIndex);
      continue;
    }
    pageHtml.push(text.html);
    textPageCount += 1;
  }

  if (pageHtml.length === 0) return { ok: false, error: 'EMPTY' };

  const html = joinDocxPages(pageHtml);
  const blob = await exportHtmlToDocx(html, {
    title: exportBaseName(doc.name),
    headerText: request.headerFooter ? doc.name : undefined,
    footerPageNumbers: request.headerFooter === true,
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());

  // 4. Tell the user exactly what the mode cost them
  const issues: FidelityIssue[] = [];
  if (emptyTextPages.length > 0) {
    issues.push({
      code: 'pdf.noTextLayer',
      severity: 'loss',
      count: emptyTextPages.length,
      messageKey: 'tools.pdfEditor.fidelityNoTextLayer',
      detail: emptyTextPages.map((page) => `p${page}`).join(', '),
    });
  }
  if (request.mode === 'raster') {
    issues.push({
      code: 'pdf.rasterized',
      severity: 'warning',
      count: imagePages,
      messageKey: 'tools.pdfEditor.fidelityRasterized',
    });
  }
  if (request.mode === 'text' || request.mode === 'mixed') {
    const exportedPageIds = new Set(selected.map((page) => page.pageId));
    const objects = doc.objects.filter((object) => exportedPageIds.has(object.page)).length;
    if (objects > 0 && request.mode === 'text') {
      issues.push({
        code: 'pdf.objectsNotInText',
        severity: 'warning',
        count: objects,
        messageKey: 'tools.pdfEditor.fidelityObjectsNotInText',
      });
    }
    const skipped = selected.filter((page) => page.sourceIndex === undefined).length;
    if (skipped > 0 && request.mode === 'text') {
      issues.push({
        code: 'pdf.skippedPages',
        severity: 'warning',
        count: skipped,
        messageKey: 'tools.pdfEditor.fidelitySkippedPages',
      });
    }
  }

  return {
    ok: true,
    value: {
      bytes,
      filename: docxFileName(doc.name),
      report: createFidelityReport('pdf', 'export', issues),
      pageCount: pageHtml.length,
      textPages: textPageCount,
      imagePages,
    },
  };
}
