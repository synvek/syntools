/**
 * Document model: pure constructors, selectors and reducers.
 *
 * Rules that the rest of the editor relies on:
 *
 * 1. **Pages are identified by `id`, never by position.** Deleting marks `deleted` instead of
 *    splicing, reordering moves entries, and objects anchor to `page.id`, so an object can never
 *    drift onto a neighbouring page. `pages.length` no longer mirrors `source.pageCount`: inserted
 *    blank pages and pages imported from attachments add entries on top of `source`.
 * 2. **View changes do not bump `revision`.** Zooming, scrolling and switching view modes must not
 *    mark the document dirty; only content mutations do.
 * 3. **Reducers return the same object when nothing changes**, so React state updates and the
 *    history stack stay cheap.
 * 4. **No I/O.** Bytes are stored by reference; nothing here reads a PDF.
 */

import { normalizeRotation } from './coords';
import type {
  PdfBlankPage,
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

/** Source key of the file the user opened; imported pages live under `attach-N` */
export const MAIN_SOURCE_KEY = 'main';

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
  const source = { ...input.source, key: input.source.key || MAIN_SOURCE_KEY };
  return {
    id: input.id ?? createDocId(),
    name: input.name,
    source,
    attachments: [],
    pages: Array.from({ length: source.pageCount }, (_, sourceIndex) => ({
      id: pageIdFor(source.key, sourceIndex),
      sourceKey: source.key,
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

/** Deterministic page id: stable across reloads, unique per (source, index) */
export function pageIdFor(sourceKey: string, sourceIndex: number): string {
  return `page-${sourceKey}-${sourceIndex}`;
}

/** Document before a file is opened (empty state); `pageCount` is 0 and saves must refuse it */
export function createEmptyDoc(now = Date.now()): PdfEditorDoc {
  return createDoc({
    name: '',
    source: {
      key: MAIN_SOURCE_KEY,
      bytes: new Uint8Array(0),
      pageCount: 0,
      encrypted: false,
      fingerprint: '',
    },
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

export function pageById(doc: PdfEditorDoc, pageId: string): PdfPageState | null {
  return doc.pages.find((page) => page.id === pageId) ?? null;
}

/** 1-based position in visible order, or 0 when the page is missing/deleted */
export function visiblePageIndexById(doc: PdfEditorDoc, pageId: string): number {
  const visible = visiblePages(doc);
  const index = visible.findIndex((page) => page.id === pageId);
  return index < 0 ? 0 : index + 1;
}

/** Add a rotation on top of the page's own /Rotate (90 + 270 wraps back to 0) */
export function setPageRotation(doc: PdfEditorDoc, pageId: string, delta: number): PdfEditorDoc {
  let changed = false;
  const pages = doc.pages.map((page) => {
    if (page.id !== pageId) return page;
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
    state.id === target.id ? { ...state, deleted: true } : state,
  );
  const next = touch({ ...doc, pages });
  return { ...next, view: { ...next.view, page: clampPage(next, next.view.page) } };
}

/** Bring a previously deleted page back (undo-friendly, M2) */
export function restorePage(doc: PdfEditorDoc, pageId: string): PdfEditorDoc {
  let changed = false;
  const pages = doc.pages.map((page) => {
    if (page.id !== pageId || !page.deleted) return page;
    changed = true;
    return { ...page, deleted: false };
  });
  return changed ? touch({ ...doc, pages }) : doc;
}

/** Array position where a page inserted at `atVisibleIndex` (1-based) belongs */
function insertionPoint(doc: PdfEditorDoc, atVisibleIndex: number): number {
  const visible = visiblePages(doc);
  const rounded = Math.round(atVisibleIndex);
  const clamped = Math.min(
    Math.max(1, Number.isFinite(rounded) ? rounded : visible.length + 1),
    visible.length + 1,
  );
  if (clamped <= visible.length) {
    const targetId = visible[clamped - 1].id;
    return doc.pages.findIndex((page) => page.id === targetId);
  }
  const lastId = visible[visible.length - 1]?.id;
  const lastIndex = lastId ? doc.pages.findIndex((page) => page.id === lastId) : -1;
  return lastIndex + 1;
}

function uniquePageId(doc: PdfEditorDoc, base: string): string {
  const used = new Set(doc.pages.map((page) => page.id));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/**
 * Insert an empty page at a 1-based visible position.
 *
 * The name is what the user sees; the page carries its size in `blank` because there are no source
 * bytes to copy. Rendering of blank pages lands with the page-operations UI (M2-7).
 */
export function insertBlankPage(
  doc: PdfEditorDoc,
  atVisibleIndex: number,
  size: PdfBlankPage,
): PdfEditorDoc {
  const position = insertionPoint(doc, atVisibleIndex);
  const page: PdfPageState = {
    id: uniquePageId(doc, `page-blank-${doc.pages.length}`),
    sourceKey: '',
    sourceIndex: -1,
    rotation: 0,
    blank: { ...size },
  };
  const pages = [...doc.pages.slice(0, position), page, ...doc.pages.slice(position)];
  const next = touch({ ...doc, pages });
  return { ...next, view: { ...next.view, page: visiblePageIndexById(next, page.id) } };
}

/**
 * Insert pages copied from another PDF.
 *
 * Encrypted attachments are rejected: the editor would have to keep a second password alive just
 * for saving, and the UI has no prompt for it. The caller is expected to unlock/decrypt first.
 */
export function insertPagesFrom(
  doc: PdfEditorDoc,
  atVisibleIndex: number,
  source: PdfSource,
  indices: number[],
): PdfEditorDoc {
  if (source.encrypted) return doc;
  const valid = indices.filter(
    (index) => Number.isInteger(index) && index >= 0 && index < source.pageCount,
  );
  if (valid.length === 0) return doc;

  const key = source.key || `attach-${doc.attachments.length + 1}`;
  const attachments = doc.attachments.some((item) => item.key === key)
    ? doc.attachments
    : [...doc.attachments, { ...source, key }];

  const used = new Set(doc.pages.map((page) => page.id));
  const created = valid.map((sourceIndex) => {
    const base = pageIdFor(key, sourceIndex);
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    const page: PdfPageState = { id, sourceKey: key, sourceIndex, rotation: 0 };
    return page;
  });

  const position = insertionPoint(doc, atVisibleIndex);
  const pages = [...doc.pages.slice(0, position), ...created, ...doc.pages.slice(position)];
  const next = touch({ ...doc, pages, attachments });
  return { ...next, view: { ...next.view, page: visiblePageIndexById(next, created[0].id) } };
}

/** Duplicate one page right after itself (objects stay with the original page) */
export function duplicatePage(doc: PdfEditorDoc, pageId: string): PdfEditorDoc {
  const position = doc.pages.findIndex((page) => page.id === pageId);
  if (position < 0) return doc;
  const page = doc.pages[position];
  const copy: PdfPageState = { ...page, id: uniquePageId(doc, `${page.id}-copy`) };
  const pages = [...doc.pages];
  pages.splice(position + 1, 0, copy);
  const next = touch({ ...doc, pages });
  return { ...next, view: { ...next.view, page: visiblePageIndexById(next, copy.id) } };
}

/** Move a page by id to a 1-based visible position (keyboard path for the thumbnail rail) */
export function movePageById(
  doc: PdfEditorDoc,
  pageId: string,
  toVisibleIndex: number,
): PdfEditorDoc {
  const visible = visiblePages(doc);
  if (visible.length < 2) return doc;
  const fromIndex = visible.findIndex((page) => page.id === pageId);
  if (fromIndex < 0) return doc;
  const target = Math.min(visible.length, Math.max(1, Math.round(toVisibleIndex))) - 1;
  if (target === fromIndex) return doc;

  const reordered = [...visible];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(target, 0, moved);
  const next = touch({ ...doc, pages: [...reordered, ...doc.pages.filter((p) => p.deleted)] });
  return { ...next, view: { ...next.view, page: visiblePageIndexById(next, pageId) } };
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
