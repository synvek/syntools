/**
 * Project file (`.pdfproj`): the editable source of truth, next to the flattened PDF export.
 *
 * Why it exists: a flattened PDF is a *delivery* format — every object is painted into the page
 * content stream, so text boxes, shapes and annotations can no longer be moved or restyled after
 * saving. A project file keeps the model (pages, objects, decoration, view state) plus the source
 * bytes verbatim, so reopening it restores a fully editable document and the user can still export
 * a flat PDF whenever they need to hand the file to somebody else.
 *
 * Layout (a zip, so 50 MB sources are not base64-inflated):
 *
 * ```
 * project.json                  manifest + model (no bytes, no passwords)
 * source.pdf                    the opened file, byte for byte
 * attachments/<key>.pdf         PDFs whose pages were inserted into this document
 * ```
 *
 * Rules:
 * - Bytes never enter the JSON model; the password is never written, so an encrypted document
 *   cannot be saved as a project (asking for the password again on open would be a dead end).
 * - `version` guards the model shape: a newer project is refused instead of being fed into an older
 *   reducer set.
 * - Opening never mutates the document; the caller decides how to splice it into the editor.
 */

import type { ToolResult } from '@/core/types';
import type { PdfDocModel, PdfEditorDoc, PdfSource } from '../model/types';

export const PROJECT_FORMAT = 'syntools-pdf-editor';
export const PROJECT_VERSION = 1;
export const PROJECT_EXTENSION = 'pdfproj';

const ENTRY = 'project.json';
const SOURCE_FILE = 'source.pdf';
const ATTACHMENT_DIR = 'attachments';

export type ProjectError =
  'NOT_PROJECT' | 'PROJECT_VERSION' | 'PROJECT_EMPTY' | 'PROJECT_ENCRYPTED' | 'PROJECT_FAILED';

/** The document without any bytes: `source` / `attachments` live in their own zip entries */
export type PdfProjectModel = PdfDocModel;

/** One inserted PDF: enough to rebuild `PdfSource` once the file is read back */
interface ProjectAttachmentEntry {
  key: string;
  pageCount: number;
  fingerprint: string;
  /** Path inside the zip, e.g. `attachments/attach-1.pdf` */
  file: string;
}

interface ProjectPayload {
  format: string;
  version: number;
  savedAt: number;
  /** PDF name, not the `.pdfproj` name: the flat export must keep the user's original name */
  doc: PdfProjectModel;
  sourceFile: string;
  attachments: ProjectAttachmentEntry[];
}

/** What the editor needs to rebuild a document from a project */
export interface OpenedProject {
  /** Name of the PDF the project was built from (`report.pdf`) */
  name: string;
  bytes: Uint8Array;
  attachments: PdfSource[];
  model: PdfProjectModel;
  /** Stable identity so drafts and re-opens agree; derived from the source bytes */
  fingerprint: string;
}

/** `report.pdf` → `report.pdfproj` (keeps the original name, only swaps the extension) */
export function projectFilename(pdfName: string): string {
  const base =
    pdfName
      .replace(/\.pdf$/i, '')
      .replace(/\.pdfproj$/i, '')
      .trim() || 'document';
  return `${base}.${PROJECT_EXTENSION}`;
}

/** Extension check only: the zip content is validated after parsing */
export function isProjectFile(name: string): boolean {
  return name.toLowerCase().endsWith(`.${PROJECT_EXTENSION}`);
}

/**
 * FNV-1a over the head, the tail and the length.
 *
 * Draft records are keyed by this value, so it has to be *stable across re-opens* (a content hash,
 * not a timestamp) and cheap on a 50 MB file (a full md5 would double the open time for no gain —
 * two different PDFs colliding on 4 KB + 4 KB + length is not a realistic risk here).
 */
export function fingerprintBytes(bytes: Uint8Array): string {
  const sample = 4096;
  let hash = 0x811c9dc5;
  const mix = (byte: number) => {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  };
  const head = Math.min(sample, bytes.length);
  for (let index = 0; index < head; index += 1) mix(bytes[index]);
  for (let index = Math.max(0, bytes.length - sample); index < bytes.length; index += 1)
    mix(bytes[index]);
  mix(bytes.length & 0xff);
  mix((bytes.length >>> 8) & 0xff);
  mix((bytes.length >>> 16) & 0xff);
  mix((bytes.length >>> 24) & 0xff);
  return `proj-${hash.toString(36)}-${bytes.length.toString(36)}`;
}

/** Strip the bytes (and the password, which lives inside `source`) */
function stripBytes(doc: PdfEditorDoc): PdfProjectModel {
  const model = { ...doc } as Partial<PdfEditorDoc>;
  delete model.source;
  delete model.attachments;
  return model as PdfProjectModel;
}

/**
 * Pack the document into `.pdfproj` bytes.
 *
 * `doc` should already carry the saved revision (`markSaved`), so reopening it does not start
 * dirty.
 */
export async function saveProject(
  doc: PdfEditorDoc,
): Promise<ToolResult<{ bytes: Uint8Array; filename: string }>> {
  // The password is memory-only; a project without it would open to a password prompt it cannot
  // answer, so refuse instead of writing a file that cannot be reopened.
  if (doc.source.encrypted) return { ok: false, error: 'PROJECT_ENCRYPTED' };

  try {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const attachments: ProjectAttachmentEntry[] = doc.attachments.map((attachment) => ({
      key: attachment.key,
      pageCount: attachment.pageCount,
      fingerprint: attachment.fingerprint,
      file: `${ATTACHMENT_DIR}/${attachment.key}.pdf`,
    }));

    const payload: ProjectPayload = {
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      savedAt: Date.now(),
      doc: stripBytes(doc),
      sourceFile: SOURCE_FILE,
      attachments,
    };

    zip.file(ENTRY, JSON.stringify(payload));
    zip.file(SOURCE_FILE, doc.source.bytes);
    for (const [index, attachment] of doc.attachments.entries()) {
      const entry = attachments[index];
      if (entry) zip.file(entry.file, attachment.bytes);
    }

    const buffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    return {
      ok: true,
      value: { bytes: new Uint8Array(buffer), filename: projectFilename(doc.name) },
    };
  } catch {
    return { ok: false, error: 'PROJECT_FAILED' };
  }
}

/** Read `.pdfproj` bytes back into a document the editor can adopt */
export async function openProject(
  bytes: Uint8Array,
  name = `document.${PROJECT_EXTENSION}`,
): Promise<ToolResult<OpenedProject>> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(bytes);
    const entry = zip.file(ENTRY);
    if (!entry) return { ok: false, error: 'NOT_PROJECT' };

    const payload = JSON.parse(await entry.async('string')) as ProjectPayload;
    if (payload.format !== PROJECT_FORMAT) return { ok: false, error: 'NOT_PROJECT' };
    // A newer editor may know fields this build would silently drop
    if (typeof payload.version !== 'number' || payload.version > PROJECT_VERSION) {
      return { ok: false, error: 'PROJECT_VERSION' };
    }
    if (!payload.doc || !Array.isArray(payload.doc.pages) || payload.doc.pages.length === 0) {
      return { ok: false, error: 'PROJECT_EMPTY' };
    }

    const sourceEntry = zip.file(payload.sourceFile || SOURCE_FILE);
    if (!sourceEntry) return { ok: false, error: 'NOT_PROJECT' };
    const sourceBytes = await sourceEntry.async('uint8array');
    if (sourceBytes.length === 0) return { ok: false, error: 'PROJECT_EMPTY' };

    const attachments: PdfSource[] = [];
    for (const record of payload.attachments ?? []) {
      const file = zip.file(record.file);
      // A page list that points at a missing attachment would render placeholders forever and fail
      // at save time; refusing the whole project is the honest answer.
      if (!file) return { ok: false, error: 'NOT_PROJECT' };
      attachments.push({
        key: record.key,
        bytes: await file.async('uint8array'),
        pageCount: record.pageCount,
        encrypted: false,
        fingerprint: record.fingerprint,
      });
    }

    const model: PdfProjectModel = { ...payload.doc };
    return {
      ok: true,
      value: {
        name: model.name || name.replace(/\.pdfproj$/i, '.pdf'),
        bytes: sourceBytes,
        attachments,
        model,
        fingerprint: fingerprintBytes(sourceBytes),
      },
    };
  } catch {
    return { ok: false, error: 'PROJECT_FAILED' };
  }
}
