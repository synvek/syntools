/**
 * Undo/redo as a stack of document snapshots.
 *
 * Why snapshots instead of `apply`/`revert` commands:
 * - every reducer in `doc.ts` is already pure and returns a new object, so "revert" needs no extra code;
 * - `source.bytes` is shared by reference, so a snapshot is a few arrays, not a PDF copy;
 * - undo restores `revision`, which means undoing back to the saved state also clears "unsaved changes".
 *
 * Two entry points:
 * - `record` — a content change, pushed as an undo step (with optional merging for drags);
 * - `syncPresent` — view/zoom/save-state only, replaces the current snapshot without adding a step.
 */

import type { PdfEditorDoc } from './types';

export interface HistoryEntry {
  doc: PdfEditorDoc;
  label: string;
  /** Consecutive changes with the same key inside the merge window collapse into one step */
  mergeKey?: string;
  at: number;
}

export interface History {
  past: HistoryEntry[];
  present: HistoryEntry;
  future: HistoryEntry[];
  /** Maximum number of undo steps */
  limit: number;
}

export interface RecordOptions {
  label: string;
  mergeKey?: string;
  /** Injectable clock so merge-window tests do not sleep */
  at?: number;
}

export const DEFAULT_LIMIT = 50;
export const MERGE_WINDOW_MS = 500;

export function createHistory(
  doc: PdfEditorDoc,
  options: { limit?: number; now?: number } = {},
): History {
  return {
    past: [],
    present: { doc, label: 'open', at: options.now ?? Date.now() },
    future: [],
    limit: Math.max(1, options.limit ?? DEFAULT_LIMIT),
  };
}

export function currentDoc(history: History): PdfEditorDoc {
  return history.present.doc;
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

export function undoDepth(history: History): number {
  return history.past.length;
}

export function redoDepth(history: History): number {
  return history.future.length;
}

/** Push a content change. No-op when the reducer returned the same document. */
export function record(history: History, doc: PdfEditorDoc, options: RecordOptions): History {
  if (doc === history.present.doc) return history;
  const at = options.at ?? Date.now();
  const { mergeKey } = options;

  if (
    mergeKey &&
    history.present.mergeKey === mergeKey &&
    at - history.present.at <= MERGE_WINDOW_MS
  ) {
    return {
      ...history,
      present: { doc, label: options.label, mergeKey, at },
      future: [],
    };
  }

  const past = [...history.past, history.present];
  return {
    past: past.length > history.limit ? past.slice(past.length - history.limit) : past,
    present: { doc, label: options.label, mergeKey, at },
    future: [],
    limit: history.limit,
  };
}

/**
 * Replace the current snapshot without creating an undo step.
 *
 * Used for view changes (zoom / current page) and for `markSaved`, which must not appear in undo.
 * Past and future are kept, so undoing later still lands on a document that carries the new
 * `savedRevision` baseline.
 */
export function syncPresent(history: History, doc: PdfEditorDoc): History {
  if (doc === history.present.doc) return history;
  return { ...history, present: { ...history.present, doc } };
}

export function undo(history: History): History {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  return {
    ...history,
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo(history: History): History {
  if (history.future.length === 0) return history;
  const [next, ...rest] = history.future;
  return {
    ...history,
    past: [...history.past, history.present],
    present: next,
    future: rest,
  };
}

/** Start a new document (open / close): drops both stacks */
export function resetHistory(history: History, doc: PdfEditorDoc, now = Date.now()): History {
  return {
    past: [],
    present: { doc, label: 'open', at: now },
    future: [],
    limit: history.limit,
  };
}
