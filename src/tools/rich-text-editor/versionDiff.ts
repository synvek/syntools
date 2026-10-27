import { diffLines } from 'diff';
import type { ToolResult } from '@/core/types';
import { htmlToPlain } from './core';

/**
 * Version diff (pure logic, kept testable):
 * HTML → canonical text lines (reusing htmlToPlain's block line breaks) → diffLines → structured diff.
 *
 * Produces two shapes: unified rows and side-by-side rows.
 * The former drives stats and screen-reader output, the latter drives the panel.
 */

export type DiffRowKind = 'equal' | 'insert' | 'delete';

export interface DiffRow {
  kind: DiffRowKind;
  /** Line text (without the trailing newline) */
  text: string;
  /** Line number in the base version (1-based); null for inserted lines */
  beforeLine: number | null;
  /** Line number in the current version (1-based); null for deleted lines */
  afterLine: number | null;
}

export interface DiffStats {
  addedLines: number;
  removedLines: number;
  addedChars: number;
  removedChars: number;
  beforeLines: number;
  afterLines: number;
}

export interface VersionDiffResult extends DiffStats {
  rows: DiffRow[];
  /** Both sides are identical */
  identical: boolean;
  /** Line similarity from 0 to 1 (1 means identical) */
  similarity: number;
}

/** Shared empty-state error code, rendered by translateToolError in the UI */
const EMPTY_ERROR = 'EMPTY';

/** Split into lines and drop the trailing empty line, so line numbers are not inflated */
function toLines(text: string): string[] {
  if (!text) return [];
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * Pre-normalization for the line diff: ensure a trailing newline.
 * Otherwise jsdiff treats a missing final newline as a different block, marking the first line as added.
 */
function toDiffText(text: string): string {
  if (!text) return '';
  return text.endsWith('\n') ? text : `${text}\n`;
}

/**
 * Build the version diff.
 * Returns EMPTY when neither side has comparable text, so the UI shows a hint instead of a blank panel.
 */
export function buildVersionDiff(
  beforeHtml: string,
  afterHtml: string,
): ToolResult<VersionDiffResult> {
  const beforeText = htmlToPlain(beforeHtml);
  const afterText = htmlToPlain(afterHtml);
  if (!beforeText && !afterText) return { ok: false, error: EMPTY_ERROR };

  const rows: DiffRow[] = [];
  let beforeLine = 1;
  let afterLine = 1;
  let addedLines = 0;
  let removedLines = 0;
  let addedChars = 0;
  let removedChars = 0;

  for (const change of diffLines(toDiffText(beforeText), toDiffText(afterText))) {
    const lines = toLines(change.value);
    if (change.added) {
      for (const line of lines) {
        rows.push({ kind: 'insert', text: line, beforeLine: null, afterLine: afterLine++ });
        addedLines += 1;
        addedChars += line.length;
      }
    } else if (change.removed) {
      for (const line of lines) {
        rows.push({ kind: 'delete', text: line, beforeLine: beforeLine++, afterLine: null });
        removedLines += 1;
        removedChars += line.length;
      }
    } else {
      for (const line of lines) {
        rows.push({ kind: 'equal', text: line, beforeLine: beforeLine++, afterLine: afterLine++ });
      }
    }
  }

  const beforeLines = Math.max(0, beforeLine - 1);
  const afterLines = Math.max(0, afterLine - 1);
  const identical = addedLines === 0 && removedLines === 0;

  return {
    ok: true,
    value: {
      rows,
      addedLines,
      removedLines,
      addedChars,
      removedChars,
      beforeLines,
      afterLines,
      identical,
      similarity: identical
        ? 1
        : Math.max(0, 1 - (addedLines + removedLines) / Math.max(1, beforeLines + afterLines)),
    },
  };
}

export type SideRowKind = 'equal' | 'change' | 'insert' | 'delete';

/** Side-by-side row: a null side means the row does not exist there */
export interface DiffSideRow {
  kind: SideRowKind;
  left: DiffRow | null;
  right: DiffRow | null;
}

/**
 * Convert unified rows into side-by-side rows:
 * Consecutive delete/insert blocks are paired by index (a pair means a modification); leftovers stay alone.
 */
export function buildSideBySide(rows: readonly DiffRow[]): DiffSideRow[] {
  const out: DiffSideRow[] = [];
  let index = 0;
  while (index < rows.length) {
    const row = rows[index];
    if (row.kind === 'equal') {
      out.push({ kind: 'equal', left: row, right: row });
      index += 1;
      continue;
    }
    const deletions: DiffRow[] = [];
    const insertions: DiffRow[] = [];
    while (index < rows.length && rows[index].kind !== 'equal') {
      const current = rows[index];
      if (current.kind === 'delete') deletions.push(current);
      else insertions.push(current);
      index += 1;
    }
    const pairs = Math.max(deletions.length, insertions.length);
    for (let k = 0; k < pairs; k += 1) {
      const left = deletions[k] ?? null;
      const right = insertions[k] ?? null;
      out.push({
        left,
        right,
        kind: left && right ? 'change' : left ? 'delete' : 'insert',
      });
    }
  }
  return out;
}
