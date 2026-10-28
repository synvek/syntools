import type { CommentThread } from '../../core/comments/model';

/**
 * Workbook comment storage (P1-2).
 *
 * Threads are app-side data anchored to cells (`{ kind: 'cell', sheetId, row, col }`) and travel
 * with the snapshot under `syntoolsComments` — the same pattern as `syntoolsCharts`. They are not
 * written into xlsx (the sheet's native comment format differs), so export reports them as a
 * fidelity warning instead of silently dropping them.
 */
export type SheetCommentMap = Record<string, CommentThread[]>;

interface CommentsCarrier {
  syntoolsComments?: SheetCommentMap;
}

/** Read + validate the comment map carried by a snapshot; unknown entries are dropped */
export function readSheetComments(snapshot: CommentsCarrier | null | undefined): SheetCommentMap {
  const source = snapshot?.syntoolsComments;
  if (!source || typeof source !== 'object') return {};
  const next: SheetCommentMap = {};
  for (const [sheetId, threads] of Object.entries(source)) {
    if (!Array.isArray(threads)) continue;
    const valid = threads.filter(
      (thread) => thread && typeof thread === 'object' && Array.isArray(thread.comments),
    );
    if (valid.length > 0) next[sheetId] = valid;
  }
  return next;
}

export function countSheetComments(map: SheetCommentMap): number {
  return Object.values(map).reduce((total, threads) => total + threads.length, 0);
}

export function threadsForSheet(map: SheetCommentMap, sheetId: string | null): CommentThread[] {
  if (!sheetId) return [];
  return map[sheetId] ?? [];
}

/** Immutable update of one sheet's thread list; empty lists drop the sheet key */
export function setSheetThreads(
  map: SheetCommentMap,
  sheetId: string,
  threads: CommentThread[],
): SheetCommentMap {
  const next = { ...map };
  if (threads.length === 0) delete next[sheetId];
  else next[sheetId] = threads;
  return next;
}

/** Attach the comment map to a snapshot (no-op shape when there is nothing to store) */
export function withSheetComments<T extends object>(
  snapshot: T,
  map: SheetCommentMap,
): T & CommentsCarrier {
  const next: T & CommentsCarrier = { ...snapshot };
  if (countSheetComments(map) > 0) next.syntoolsComments = map;
  else delete next.syntoolsComments;
  return next;
}

/** 0-based row/column → A1 reference (matches what Excel users see) */
export function cellLabel(row: number, col: number): string {
  let letters = '';
  let index = Math.max(0, col);
  do {
    letters = String.fromCharCode(65 + (index % 26)) + letters;
    index = Math.floor(index / 26) - 1;
  } while (index >= 0);
  return `${letters}${Math.max(0, row) + 1}`;
}
