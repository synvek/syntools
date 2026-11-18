/**
 * Document model: pure constructors, selectors and reducers.
 *
 * Rules that the rest of the editor relies on:
 *
 * 1. **`pages.length` always equals `source.pageCount`.** Deleting marks `deleted` instead of
 *    splicing, so `sourceIndex` never shifts and saves can rebuild from the original bytes.
 * 2. **View changes do not bump `revision`.** Zooming, scrolling and switching view modes must not
 *    mark the document dirty; only content mutations do.
 * 3. **Reducers return the same object when nothing changes**, so React state updates and the
 *    history stack stay cheap.
 * 4. **No I/O.** Bytes are stored by reference; nothing here reads a PDF.
 */

import { normalizeRotation } from './coords';
import type {
  PdfEditorDoc,
  PdfObject,
  PdfPageState,
  PdfRotation,
  PdfSource,
  ViewMode,
  ZoomMode,
} from './types';

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 4;

/** Preset zoom levels used by the ribbon combo box (custom values are still allowed) */
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return 1;
  const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  return Math.round(clamped * 100) / 100;
}

export interface CreateDocInput {
  name: string;
  source: PdfSource;
  id?: string;
  now?: number;
}

/** Build a document from an opened file: one page state per source page, nothing dirty */
export function createDoc(input: CreateDocInput): PdfEditorDoc {
  const now = input.now ?? Date.now();
  return {
    id: input.id ?? createDocId(),
    name: input.name,
    source: input.source,
    pages: Array.from({ length: input.source.pageCount }, (_, sourceIndex) => ({
      sourceIndex,
      rotation: 0 as PdfRotation,
    })),
    objects: [],
    forms: {},
    meta: { title: input.name.replace(/\.pdf$/i, '') },
    view: { mode: 'continuous', zoom: 1, zoomMode: 'fit-width', page: 1 },
    updatedAt: now,
    revision: 0,
    savedRevision: 0,
  };
}

/** Document before a file is opened (empty state); `pageCount` is 0 and saves must refuse it */
export function createEmptyDoc(now = Date.now()): PdfEditorDoc {
  return createDoc({
    name: '',
    source: { bytes: new Uint8Array(0), pageCount: 0, encrypted: false, fingerprint: '' },
    now,
  });
}

function createDocId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof crypto.randomUUID === 'function') return `pdf-${cryptoApi.randomUUID()}`;
  return `pdf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* -------------------------------------------------------------------------- */
/* Selectors                                                                   */
/* -------------------------------------------------------------------------- */

export function visiblePages(doc: PdfEditorDoc): PdfPageState[] {
  return doc.pages.filter((page) => !page.deleted);
}

export function visiblePageCount(doc: PdfEditorDoc): number {
  let count = 0;
  for (const page of doc.pages) if (!page.deleted) count += 1;
  return count;
}

export function isDirty(doc: PdfEditorDoc): boolean {
  return doc.revision !== doc.savedRevision;
}

/** Clamp a 1-based visible page number into range (empty documents report page 1) */
export function clampPage(doc: PdfEditorDoc, page: number): number {
  const count = visiblePageCount(doc);
  if (count <= 0) return 1;
  const rounded = Math.round(page);
  if (!Number.isFinite(rounded)) return 1;
  return Math.min(count, Math.max(1, rounded));
}

/* -------------------------------------------------------------------------- */
/* View reducers (never dirty)                                                 */
/* -------------------------------------------------------------------------- */

export function setViewMode(doc: PdfEditorDoc, mode: ViewMode): PdfEditorDoc {
  if (doc.view.mode === mode) return doc;
  return { ...doc, view: { ...doc.view, mode } };
}

export function setZoom(doc: PdfEditorDoc, zoom: number): PdfEditorDoc {
  const next = clampZoom(zoom);
  if (doc.view.zoom === next) return doc;
  return { ...doc, view: { ...doc.view, zoom: next } };
}

export function setZoomMode(doc: PdfEditorDoc, zoomMode: ZoomMode): PdfEditorDoc {
  if (doc.view.zoomMode === zoomMode) return doc;
  return { ...doc, view: { ...doc.view, zoomMode } };
}

export function setCurrentPage(doc: PdfEditorDoc, page: number): PdfEditorDoc {
  const next = clampPage(doc, page);
  if (doc.view.page === next) return doc;
  return { ...doc, view: { ...doc.view, page: next } };
}

/* -------------------------------------------------------------------------- */
/* Save-state reducers                                                         */
/* -------------------------------------------------------------------------- */

/** Mark every change up to now as saved (call after a successful download) */
export function markSaved(doc: PdfEditorDoc, now = Date.now()): PdfEditorDoc {
  return { ...doc, savedRevision: doc.revision, updatedAt: now };
}

/** Bump `revision`; every content mutation goes through here */
export function touch(doc: PdfEditorDoc, now = Date.now()): PdfEditorDoc {
  return { ...doc, revision: doc.revision + 1, updatedAt: now };
}

/* -------------------------------------------------------------------------- */
/* Page reducers                                                               */
/* -------------------------------------------------------------------------- */

/** Add a rotation on top of the page's own /Rotate (90 + 270 wraps back to 0) */
export function setPageRotation(
  doc: PdfEditorDoc,
  sourceIndex: number,
  delta: number,
): PdfEditorDoc {
  let changed = false;
  const pages = doc.pages.map((page) => {
    if (page.sourceIndex !== sourceIndex) return page;
    const rotation = normalizeRotation(page.rotation + delta);
    if (rotation === page.rotation) return page;
    changed = true;
    return { ...page, rotation };
  });
  return changed ? touch({ ...doc, pages }) : doc;
}

/** Rotate every visible page by the same delta */
export function rotateAllPages(doc: PdfEditorDoc, delta: number): PdfEditorDoc {
  let changed = false;
  const pages = doc.pages.map((page) => {
    if (page.deleted) return page;
    const rotation = normalizeRotation(page.rotation + delta);
    if (rotation === page.rotation) return page;
    changed = true;
    return { ...page, rotation };
  });
  return changed ? touch({ ...doc, pages }) : doc;
}

/**
 * Move a page in visible order (1-based, thumbnails).
 *
 * Deleted pages are kept but parked at the end: they are invisible, and `savePdf` skips them, so
 * their position cannot affect output.
 */
export function movePage(doc: PdfEditorDoc, from: number, to: number): PdfEditorDoc {
  const visible = doc.pages.filter((page) => !page.deleted);
  if (visible.length < 2) return doc;
  const fromIndex = clampPage(doc, from) - 1;
  const toIndex = clampPage(doc, to) - 1;
  if (fromIndex === toIndex) return doc;
  const reordered = [...visible];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return touch({ ...doc, pages: [...reordered, ...doc.pages.filter((p) => p.deleted)] });
}

/**
 * Hide a page without touching the source bytes; clamps the current page back into range.
 *
 * Out-of-range input is a no-op rather than clamping: a stale index must never silently delete
 * a different page.
 */
export function deletePage(doc: PdfEditorDoc, page: number): PdfEditorDoc {
  const visible = visiblePages(doc);
  const index = Math.round(page);
  if (!Number.isFinite(index) || index < 1 || index > visible.length) return doc;
  const target = visible[index - 1];
  const pages = doc.pages.map((state) =>
    state.sourceIndex === target.sourceIndex ? { ...state, deleted: true } : state,
  );
  const next = touch({ ...doc, pages });
  return { ...next, view: { ...next.view, page: clampPage(next, next.view.page) } };
}

/** Bring a previously deleted page back (undo-friendly, M2) */
export function restorePage(doc: PdfEditorDoc, sourceIndex: number): PdfEditorDoc {
  let changed = false;
  const pages = doc.pages.map((page) => {
    if (page.sourceIndex !== sourceIndex || !page.deleted) return page;
    changed = true;
    return { ...page, deleted: false };
  });
  return changed ? touch({ ...doc, pages }) : doc;
}

/* -------------------------------------------------------------------------- */
/* Object reducers                                                             */
/* -------------------------------------------------------------------------- */

export function addObject(doc: PdfEditorDoc, object: PdfObject): PdfEditorDoc {
  return touch({ ...doc, objects: [...doc.objects, object] });
}

/** Replace one object; returning the same reference counts as "no change" */
export function updateObject(
  doc: PdfEditorDoc,
  id: string,
  update: (object: PdfObject) => PdfObject,
): PdfEditorDoc {
  let changed = false;
  const objects = doc.objects.map((object) => {
    if (object.id !== id) return object;
    const next = update(object);
    if (next !== object) changed = true;
    return next;
  });
  return changed ? touch({ ...doc, objects }) : doc;
}

export function removeObject(doc: PdfEditorDoc, id: string): PdfEditorDoc {
  const objects = doc.objects.filter((object) => object.id !== id);
  return objects.length === doc.objects.length ? doc : touch({ ...doc, objects });
}
