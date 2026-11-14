import type { CommentThread } from '../../core/comments/model';
import { readSheetComments, type SheetCommentMap } from './comments';

/**
 * Comment threads → xlsx notes (P1-9).
 *
 * Excel has two comment systems: legacy notes (`xl/comments*.xml`, what `cell.note` writes) and
 * modern threaded comments (`xl/threadedComments/*`). This editor stores a *thread* per cell but can
 * only write the legacy kind, so a thread is flattened into one note: every reply survives as a
 * `作者: 正文` line, and the fidelity report says so instead of pretending it is a thread.
 *
 * The note is written by exceljs (`cell.note`), which also emits the VML drawing — hand-rolling the
 * XML would mean reimplementing that part for no gain.
 */

export interface ThreadNote {
  row: number;
  col: number;
  text: string;
}

/** Excel's own limit is 32,767; staying well below keeps the hover box usable */
export const NOTE_MAX_CHARS = 4_000;

const SEPARATOR = '\n';

/**
 * Flatten one thread into note text, or `null` when it has nothing to say (all bodies blank).
 * Resolved threads are marked, because "resolved" is information the reader would otherwise lose.
 */
export function formatThreadNote(thread: CommentThread): string | null {
  const entries = (thread.comments ?? []).filter(
    (entry) => typeof entry.body === 'string' && entry.body.trim().length > 0,
  );
  if (entries.length === 0) return null;
  const lines = entries.map((entry) => `${entry.author?.trim() || '—'}: ${entry.body.trim()}`);
  if (thread.resolved) lines.push('✓');
  const text = lines.join(SEPARATOR);
  return text.length > NOTE_MAX_CHARS ? `${text.slice(0, NOTE_MAX_CHARS)}…` : text;
}

/**
 * Group thread notes by sheet. Two threads on the same cell are merged (one note per cell is all
 * xlsx allows); orphaned threads are skipped, their target no longer exists.
 */
export function collectThreadNotes(map: SheetCommentMap): Record<string, ThreadNote[]> {
  const result: Record<string, ThreadNote[]> = {};
  for (const [sheetId, threads] of Object.entries(map)) {
    const byCell = new Map<string, ThreadNote>();
    for (const thread of threads) {
      if (thread.orphaned) continue;
      const anchor = thread.anchor;
      if (anchor.kind !== 'cell') continue;
      const text = formatThreadNote(thread);
      if (!text) continue;
      const key = `${anchor.row}:${anchor.col}`;
      const existing = byCell.get(key);
      if (existing) existing.text = `${existing.text}\n\n${text}`;
      else byCell.set(key, { row: anchor.row, col: anchor.col, text });
    }
    if (byCell.size > 0) result[sheetId] = [...byCell.values()];
  }
  return result;
}

/** Convenience for the export path: notes of one sheet, ready to be written cell by cell */
export function threadNotesForSheet(
  notes: Record<string, ThreadNote[]>,
  sheetId: string,
): ThreadNote[] {
  return notes[sheetId] ?? [];
}

/** Snapshot → notes; kept here so the exporter stays free of comment-model details */
export function buildThreadNotes(snapshot: unknown): Record<string, ThreadNote[]> {
  return collectThreadNotes(readSheetComments(snapshot as Parameters<typeof readSheetComments>[0]));
}
