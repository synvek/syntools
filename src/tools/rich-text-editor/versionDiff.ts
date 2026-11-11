import type { ToolResult } from '@/core/types';
import { blocksFromHtml, compareBlocks, type CompareSegment } from './compare';

/**
 * Version diff (pure logic, kept testable):
 * HTML → top-level blocks → block-level diff (`compareBlocks`, the same algorithm "compare with file"
 * uses) → unified rows → side-by-side rows.
 *
 * Block granularity instead of the previous plain-text line diff is what makes structural edits visible
 * at all: flattening the document to lines turns a heading that became a paragraph, a list that became
 * a paragraph, or a moved block into "no change". Inside a changed block the panel still highlights the
 * changed words, because `compareBlocks` pairs a rewrite into one `replace` carrying a token diff.
 */

export type DiffRowKind = 'equal' | 'insert' | 'delete' | 'format';

export interface DiffRow {
  kind: DiffRowKind;
  /** Block text (multi-line blocks such as lists / tables join their parts with `\n`) */
  text: string;
  /** Block number in the base version (1-based); null for inserted blocks */
  beforeLine: number | null;
  /** Block number in the current version (1-based); null for deleted blocks */
  afterLine: number | null;
  /** Block kind on the base side (`p` / `h2` / `li` / `table` …) */
  beforeType?: string;
  /** Block kind on the current side */
  afterType?: string;
  /**
   * Token diff of the paired `replace` this row belongs to. Both rows of a pair carry the same array:
   * the left cell shows `equal` + `delete` parts, the right one `equal` + `insert` parts.
   */
  segments?: CompareSegment[];
}

export interface DiffStats {
  /** Blocks that only exist in the current version */
  addedLines: number;
  /** Blocks that only exist in the base version */
  removedLines: number;
  addedChars: number;
  removedChars: number;
  /** Block count per side */
  beforeLines: number;
  afterLines: number;
}

export interface VersionDiffResult extends DiffStats {
  rows: DiffRow[];
  /** Both sides are identical — no text, block-kind or order change */
  identical: boolean;
  /** Block similarity from 0 to 1 (1 means identical text; a pure format change also scores 1) */
  similarity: number;
}

/** Shared empty-state error code, rendered by translateToolError in the UI */
const EMPTY_ERROR = 'EMPTY';

/**
 * Build the version diff.
 * Returns EMPTY when neither side has a block with text, so the UI shows a hint instead of a blank panel.
 */
export function buildVersionDiff(
  beforeHtml: string,
  afterHtml: string,
): ToolResult<VersionDiffResult> {
  // Empty blocks carry no diff information (and would only add blank rows)
  const before = blocksFromHtml(beforeHtml).filter((block) => block.text !== '');
  const after = blocksFromHtml(afterHtml).filter((block) => block.text !== '');
  if (!before.length && !after.length) return { ok: false, error: EMPTY_ERROR };

  const { changes } = compareBlocks(before, after);

  /** Change index per block, so the walk below can emit equal rows for everything untouched */
  const changeOfBefore = new Map<number, number>();
  const changeOfAfter = new Map<number, number>();
  changes.forEach((change, index) => {
    if (change.beforeIndex !== null) changeOfBefore.set(change.beforeIndex, index);
    if (change.afterIndex !== null) changeOfAfter.set(change.afterIndex, index);
  });

  const rows: DiffRow[] = [];
  let addedLines = 0;
  let removedLines = 0;
  let addedChars = 0;
  let removedChars = 0;

  let b = 0;
  let a = 0;
  while (b < before.length || a < after.length) {
    const baseBlock = before[b];
    const targetBlock = after[a];
    const changeIndex = b < before.length ? changeOfBefore.get(b) : undefined;
    const change = changeIndex === undefined ? undefined : changes[changeIndex];

    // Paired replace (or a format change): one change object owns both blocks
    if (baseBlock && targetBlock && change && changeIndex === changeOfAfter.get(a)) {
      if (change.formatOnly) {
        rows.push({
          kind: 'format',
          text: baseBlock.text,
          beforeLine: b + 1,
          afterLine: a + 1,
          beforeType: baseBlock.type,
          afterType: targetBlock.type,
        });
      } else {
        rows.push({
          kind: 'delete',
          text: baseBlock.text,
          beforeLine: b + 1,
          afterLine: null,
          beforeType: baseBlock.type,
          segments: change.segments,
        });
        rows.push({
          kind: 'insert',
          text: targetBlock.text,
          beforeLine: null,
          afterLine: a + 1,
          afterType: targetBlock.type,
          segments: change.segments,
        });
        addedLines += 1;
        removedLines += 1;
        addedChars += targetBlock.text.length;
        removedChars += baseBlock.text.length;
      }
      b += 1;
      a += 1;
      continue;
    }

    // Remaining base-only blocks are deletions
    if (!targetBlock || (baseBlock && changeIndex !== undefined)) {
      if (!baseBlock) break;
      rows.push({
        kind: 'delete',
        text: baseBlock.text,
        beforeLine: b + 1,
        afterLine: null,
        beforeType: baseBlock.type,
      });
      removedLines += 1;
      removedChars += baseBlock.text.length;
      b += 1;
      continue;
    }

    // Remaining current-only blocks are insertions
    if (!baseBlock || changeOfAfter.has(a)) {
      if (!targetBlock) break;
      rows.push({
        kind: 'insert',
        text: targetBlock.text,
        beforeLine: null,
        afterLine: a + 1,
        afterType: targetBlock.type,
      });
      addedLines += 1;
      addedChars += targetBlock.text.length;
      a += 1;
      continue;
    }

    rows.push({
      kind: 'equal',
      text: baseBlock.text,
      beforeLine: b + 1,
      afterLine: a + 1,
      beforeType: baseBlock.type,
      afterType: targetBlock.type,
    });
    b += 1;
    a += 1;
  }

  const beforeLines = before.length;
  const afterLines = after.length;
  const identical = changes.length === 0;

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

export type SideRowKind = 'equal' | 'format' | 'change' | 'insert' | 'delete';

/** Side-by-side row: a null side means the row does not exist there */
export interface DiffSideRow {
  kind: SideRowKind;
  left: DiffRow | null;
  right: DiffRow | null;
}

/**
 * Convert unified rows into side-by-side rows:
 * Consecutive delete/insert blocks are paired by index (a pair means a modification); leftovers stay alone.
 * Unchanged and format-only rows already carry both sides.
 */
export function buildSideBySide(rows: readonly DiffRow[]): DiffSideRow[] {
  const out: DiffSideRow[] = [];
  let index = 0;
  while (index < rows.length) {
    const row = rows[index];
    if (row.kind === 'equal' || row.kind === 'format') {
      out.push({ kind: row.kind, left: row, right: row });
      index += 1;
      continue;
    }
    const deletions: DiffRow[] = [];
    const insertions: DiffRow[] = [];
    while (index < rows.length && rows[index].kind !== 'equal' && rows[index].kind !== 'format') {
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
