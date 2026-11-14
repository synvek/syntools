import { columnIndexToName } from './core';

/**
 * Multi-key sorting (P1-5).
 *
 * The engine can already sort by several columns (the `sheets-sort` facade takes an array of
 * `{column, ascending}`), so this module deliberately does **not** re-implement sorting: it only
 * decides *which rows form the body* and *which keys are usable*. Re-implementing would mean moving
 * cell data by hand and getting formula semantics wrong.
 */

export interface SortKey {
  /** Column index **relative to the selection**, matching the engine's contract */
  column: number;
  ascending: boolean;
}

export const MAX_SORT_KEYS = 3;

export interface SortSelection {
  startRow: number;
  startColumn: number;
  rows: number;
  columns: number;
}

/** The rows the sort may reorder: a header row, when present, stays where it is */
export interface SortBody {
  startRow: number;
  rows: number;
  columns: number;
}

export function sortBody(selection: SortSelection, hasHeader: boolean): SortBody | null {
  const rows = hasHeader ? selection.rows - 1 : selection.rows;
  // One row cannot be reordered, and a header with nothing under it is the same no-op
  if (rows <= 1 || selection.columns <= 0) return null;
  return {
    startRow: hasHeader ? selection.startRow + 1 : selection.startRow,
    rows,
    columns: selection.columns,
  };
}

/**
 * Drop keys that cannot be honoured instead of throwing: a saved dialog state can outlive a
 * selection change, and sorting by a column that is no longer in the range would sort by the wrong
 * data without telling anyone.
 */
export function normalizeSortKeys(keys: readonly SortKey[], columns: number): SortKey[] {
  const seen = new Set<number>();
  const usable: SortKey[] = [];
  for (const key of keys) {
    if (!Number.isInteger(key.column)) continue;
    if (key.column < 0 || key.column >= columns) continue;
    if (seen.has(key.column)) continue;
    seen.add(key.column);
    usable.push({ column: key.column, ascending: key.ascending });
    if (usable.length >= MAX_SORT_KEYS) break;
  }
  // A dialog with everything cleared still needs a deterministic order
  return usable.length > 0 ? usable : [{ column: 0, ascending: true }];
}

/**
 * Does the first row look like headers? Excel lets the user decide, but the default should match
 * what they see: text above numbers is the common case for a table.
 */
export function looksLikeHeader(
  firstRow: readonly unknown[],
  secondRow: readonly unknown[] | null,
): boolean {
  if (!secondRow) return false;
  const firstNonEmpty = firstRow.filter(
    (cell) => cell !== null && cell !== undefined && cell !== '',
  );
  if (firstNonEmpty.length === 0) return false;
  const allText = firstNonEmpty.every((cell) => typeof cell === 'string');
  if (!allText) return false;
  // At least one value below must not be text, otherwise it is just a text column with a text row
  return secondRow.some((cell) => typeof cell === 'number');
}

export interface SortColumn {
  index: number;
  label: string;
}

/**
 * Column labels for the dialog: header text when the first row is a header, spreadsheet letters
 * otherwise. Empty header cells fall back to the letter so every key can be identified.
 */
export function sortColumns(
  headerRow: readonly unknown[] | null,
  columns: number,
  startColumn = 0,
): SortColumn[] {
  return Array.from({ length: columns }, (_, index) => {
    const header = headerRow?.[index];
    const text = typeof header === 'string' ? header.trim() : '';
    return {
      index,
      label: text || columnIndexToName(startColumn + index),
    };
  });
}
