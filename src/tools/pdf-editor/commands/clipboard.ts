/**
 * In-memory object clipboard.
 *
 * Only plain model data is stored (no DOM, no pdfjs proxies), so pasting works across pages and, in
 * M3-5, across documents. `navigator.clipboard` is deliberately not used: PDF objects are structured
 * data that no other app understands, and writing JSON to the system clipboard would surprise users.
 */

import { clampNormRect } from '../model/coords';
import { clampObject, cloneObject, nextZ } from '../model/objects';
import type { PdfObject } from '../model/types';

/** Bumped when the serialized shape changes; a mismatched payload is ignored, never guessed at */
export const CLIPBOARD_VERSION = 1;

let clipboard: PdfObject[] = [];

/** Snapshot the selection; returns how many objects were copied */
export function copyObjects(objects: readonly PdfObject[]): number {
  clipboard = objects.map((object) => ({ ...object }));
  return clipboard.length;
}

interface ClipboardPayload {
  version: number;
  objects: PdfObject[];
}

/**
 * Serialize the clipboard (M3-5).
 *
 * The payload is plain JSON so a future "paste across tabs / project files" path can persist it. It
 * stays in module memory today: PDF objects mean nothing to other applications, so writing them to
 * the system clipboard would only produce garbage in Word.
 */
export function serializeClipboard(): string {
  const payload: ClipboardPayload = { version: CLIPBOARD_VERSION, objects: clipboard };
  return JSON.stringify(payload);
}

/** Restore a payload produced by `serializeClipboard`; returns how many objects were loaded */
export function deserializeClipboard(json: string): number {
  try {
    const parsed = JSON.parse(json) as Partial<ClipboardPayload>;
    if (parsed.version !== CLIPBOARD_VERSION || !Array.isArray(parsed.objects)) return 0;
    const objects = parsed.objects.filter(
      (object): object is PdfObject =>
        !!object &&
        typeof object === 'object' &&
        typeof (object as PdfObject).id === 'string' &&
        typeof (object as PdfObject).kind === 'string' &&
        typeof (object as PdfObject).page === 'string' &&
        !!(object as PdfObject).rect,
    );
    // A payload with no usable object must not wipe what the user already copied
    if (objects.length === 0) return 0;
    clipboard = objects;
    return clipboard.length;
  } catch {
    return 0;
  }
}

export function clipboardSize(): number {
  return clipboard.length;
}

export function clearClipboard(): void {
  clipboard = [];
}

export interface PasteOptions {
  /** Existing objects of the target document, used to place the pasted ones on top */
  objects: readonly PdfObject[];
  /** Target page id */
  pageId: string;
  /** Normalized offset so a paste is visible and does not sit exactly on the original */
  offset?: number;
}

/** Fresh ids, new page, stacked on top; the caller appends them in one history step */
export function pasteObjects({ objects, pageId, offset = 0.02 }: PasteOptions): PdfObject[] {
  if (clipboard.length === 0) return [];
  const startZ = nextZ(objects);

  return clipboard.map((source, index) => {
    const rect = clampNormRect({
      ...source.rect,
      x: source.rect.x + offset,
      y: source.rect.y + offset,
    });
    return clampObject(
      cloneObject(source, {
        page: pageId,
        rect,
        z: startZ + index,
        locked: undefined,
      }),
    );
  });
}
