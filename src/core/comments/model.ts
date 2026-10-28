/**
 * Shared comment model (P1-2).
 *
 * One thread model, three adapters (slide / sheet / rich text). The core only owns the data shape
 * and pure operations, so each tool can store threads wherever its document already lives
 * (`SlideDoc.comments`, workbook extras, rich-text draft) without a second source of truth.
 */

export type CommentAnchor =
  /** Slide element anchor: offsets are normalized (0~1) inside the element box */
  | { kind: 'element'; slideId: string; elementId: string; dx: number; dy: number }
  /** Free-floating anchor on a slide page (page coordinates, px @96dpi) */
  | { kind: 'page'; slideId: string; x: number; y: number }
  /** Spreadsheet cell anchor */
  | { kind: 'cell'; sheetId: string; row: number; col: number }
  /** Rich text anchor: position plus a fingerprint of the quoted text for relocation */
  | { kind: 'text'; docPos: number; fingerprint: string; quote: string };

export interface CommentEntry {
  id: string;
  author: string;
  createdAt: number;
  body: string;
}

export interface CommentThread {
  id: string;
  anchor: CommentAnchor;
  resolved: boolean;
  /**
   * The anchor target is gone (element deleted, text edited beyond recognition, cell removed).
   * Orphaned threads are kept and listed separately instead of silently disappearing.
   */
  orphaned?: boolean;
  comments: CommentEntry[];
}

export interface CommentDraft {
  author: string;
  body: string;
  /** Overrides for tests / imports */
  id?: string;
  createdAt?: number;
}

let seq = 0;

export function createCommentId(prefix = 'cmt'): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}`;
}

/** Trimmed body; empty input means "do not create" and callers should skip */
function normalizeBody(body: string): string {
  return body.trim();
}

export function createThread(anchor: CommentAnchor, draft: CommentDraft): CommentThread {
  const body = normalizeBody(draft.body);
  const entry: CommentEntry = {
    id: draft.id ?? createCommentId('c'),
    author: draft.author,
    createdAt: draft.createdAt ?? Date.now(),
    body,
  };
  return {
    id: createCommentId('t'),
    anchor,
    resolved: false,
    comments: [entry],
  };
}

export function addReply(thread: CommentThread, draft: CommentDraft): CommentThread {
  const body = normalizeBody(draft.body);
  if (!body) return thread;
  const entry: CommentEntry = {
    id: draft.id ?? createCommentId('c'),
    author: draft.author,
    createdAt: draft.createdAt ?? Date.now(),
    body,
  };
  return { ...thread, comments: [...thread.comments, entry] };
}

export function setThreadResolved(thread: CommentThread, resolved: boolean): CommentThread {
  if (thread.resolved === resolved) return thread;
  return { ...thread, resolved };
}

/**
 * Delete one entry; the first entry is the thread opener, so removing it drops the whole thread.
 * Returns `null` when nothing is left.
 */
export function removeEntry(thread: CommentThread, entryId: string): CommentThread | null {
  const index = thread.comments.findIndex((entry) => entry.id === entryId);
  if (index < 0) return thread;
  if (index === 0) return null;
  return { ...thread, comments: thread.comments.filter((entry) => entry.id !== entryId) };
}

export function latestEntry(thread: CommentThread): CommentEntry | undefined {
  return thread.comments[thread.comments.length - 1];
}

export function countUnresolved(threads: CommentThread[]): number {
  return threads.reduce((total, thread) => (thread.resolved ? total : total + 1), 0);
}

/** Newest activity first, so the panel opens on what matters */
export function sortThreads(threads: CommentThread[]): CommentThread[] {
  return [...threads].sort(
    (a, b) => (latestEntry(b)?.createdAt ?? 0) - (latestEntry(a)?.createdAt ?? 0),
  );
}

export function threadsForSlide(threads: CommentThread[], slideId: string): CommentThread[] {
  return threads.filter(
    (thread) =>
      (thread.anchor.kind === 'element' || thread.anchor.kind === 'page') &&
      thread.anchor.slideId === slideId,
  );
}

/** Small stable hash used to detect "the text under this anchor changed" */
export function textFingerprint(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  let hash = 5381;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(index)) | 0;
  }
  return `${normalized.length.toString(36)}:${(hash >>> 0).toString(36)}`;
}

/**
 * Re-locate a rich-text anchor after edits: keep the position while the fingerprint still matches,
 * otherwise look for the unique occurrence of the quote; `null` means the anchor is orphaned.
 */
export function relocateTextAnchor(anchor: Extract<CommentAnchor, { kind: 'text' }>, text: string) {
  if (textFingerprint(text) === anchor.fingerprint) {
    return Math.min(Math.max(anchor.docPos, 0), text.length);
  }
  const quote = anchor.quote.trim();
  if (!quote) return null;
  const first = text.indexOf(quote);
  if (first < 0) return null;
  // Ambiguous quote (appears twice) cannot be relocated reliably
  if (text.indexOf(quote, first + 1) >= 0) return null;
  return first;
}

/** Mark threads whose target no longer exists; used by the panel and the canvas layer */
export function markOrphaned(
  threads: CommentThread[],
  isAlive: (thread: CommentThread) => boolean,
): CommentThread[] {
  let changed = false;
  const next = threads.map((thread) => {
    const orphaned = !isAlive(thread);
    if (Boolean(thread.orphaned) === orphaned) return thread;
    changed = true;
    return { ...thread, orphaned };
  });
  return changed ? next : threads;
}
