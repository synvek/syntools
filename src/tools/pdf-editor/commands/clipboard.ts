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

let clipboard: PdfObject[] = [];

/** Snapshot the selection; returns how many objects were copied */
export function copyObjects(objects: readonly PdfObject[]): number {
  clipboard = objects.map((object) => ({ ...object }));
  return clipboard.length;
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
