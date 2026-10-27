/**
 * Pure logic for table nodes: structure normalization, cell read/write, row/column add & remove, merge / split and render layout.
 * No React / DOM references, so it is easy to unit-test and reuse in the store / node renderer.
 *
 * Data convention: `cells[row][col]` is a cell; cells covered by a merge are null,
 * and only the top-left cell of a merged region keeps content and spans.
 */

import type { TableCellData, TableData } from './types';

export const DEFAULT_TABLE_ROWS = 3;
export const DEFAULT_TABLE_COLS = 3;
const MIN_DIM = 1;
const MAX_DIM = 40;

function clampDim(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return MIN_DIM;
  return Math.min(MAX_DIM, Math.max(MIN_DIM, n));
}

function spanOf(v: unknown, max: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(max, n);
}

/** Create an empty table */
export function emptyTable(rows = DEFAULT_TABLE_ROWS, cols = DEFAULT_TABLE_COLS): TableData {
  const r = clampDim(rows);
  const c = clampDim(cols);
  return {
    rows: r,
    cols: c,
    cells: Array.from({ length: r }, () => Array.from({ length: c }, () => ({}) as TableCellData)),
  };
}

/**
 * Structure normalization: row/column counts are made valid and `cells` is padded to rows×cols.
 * Explicit `null` entries (covered by a merge) are kept; missing entries are filled with empty cells.
 */
export function normalizeTable(table: TableData | undefined): TableData {
  const rows = clampDim(table?.rows ?? DEFAULT_TABLE_ROWS);
  const cols = clampDim(table?.cols ?? DEFAULT_TABLE_COLS);
  const src = table?.cells ?? [];
  const cells: (TableCellData | null)[][] = [];
  for (let r = 0; r < rows; r += 1) {
    const row = src[r];
    const next: (TableCellData | null)[] = [];
    for (let c = 0; c < cols; c += 1) {
      const raw = Array.isArray(row) && c < row.length ? row[c] : undefined;
      next.push(raw === null ? null : (raw ?? {}));
    }
    cells.push(next);
  }
  const result: TableData = { rows, cols, cells };
  if (table?.rowWeights) result.rowWeights = [...table.rowWeights];
  if (table?.colWeights) result.colWeights = [...table.colWeights];
  return result;
}

/**
 * Make spans consistent with the structure: clamp out-of-range spans to the bounds and recompute covered cells (set to null).
 * Called after row/column add & remove to avoid dangling merges.
 */
export function sanitizeSpans(table: TableData): TableData {
  const t = normalizeTable(table);
  const src = t.cells!;
  const cells: (TableCellData | null)[][] = Array.from({ length: t.rows }, () =>
    Array.from({ length: t.cols }, () => null),
  );
  const occupied: boolean[][] = Array.from({ length: t.rows }, () =>
    Array.from({ length: t.cols }, () => false),
  );
  for (let r = 0; r < t.rows; r += 1) {
    for (let c = 0; c < t.cols; c += 1) {
      // Skip cells already covered by a merge from above / to the left (first come, first served)
      if (occupied[r][c]) continue;
      const cell = src[r][c];
      if (cell === null) continue;
      const rowSpan = spanOf(cell.rowspan, t.rows - r);
      const colSpan = spanOf(cell.colspan, t.cols - c);
      const next: TableCellData = { ...cell };
      if (rowSpan > 1) next.rowspan = rowSpan;
      else delete next.rowspan;
      if (colSpan > 1) next.colspan = colSpan;
      else delete next.colspan;
      cells[r][c] = next;
      for (let rr = r; rr < r + rowSpan; rr += 1) {
        for (let cc = c; cc < c + colSpan; cc += 1) {
          occupied[rr][cc] = true;
          if (rr === r && cc === c) continue;
          cells[rr][cc] = null;
        }
      }
    }
  }
  return { ...t, cells };
}

/** Read a cell (out-of-range or covered cells return an empty object) */
export function cellAt(table: TableData, row: number, col: number): TableCellData {
  const t = normalizeTable(table);
  const cell = t.cells?.[row]?.[col];
  return cell ?? {};
}

/** Partially update a cell (covered cells and out-of-range positions are ignored) */
export function patchCell(
  table: TableData,
  row: number,
  col: number,
  patch: Partial<TableCellData>,
): TableData {
  const t = normalizeTable(table);
  if (row < 0 || col < 0 || row >= t.rows || col >= t.cols) return t;
  if (t.cells![row][col] === null) return t;
  const cells = t.cells!.map((line, ri) =>
    ri === row ? line.map((cell, ci) => (ci === col ? { ...(cell ?? {}), ...patch } : cell)) : line,
  );
  return sanitizeSpans({ ...t, cells });
}

/** Write cell text */
export function setCellText(table: TableData, row: number, col: number, text: string): TableData {
  return patchCell(table, row, col, { text });
}

/** Insert an empty row before / after row `at` */
export function insertRow(
  table: TableData,
  at: number,
  where: 'before' | 'after' = 'after',
): TableData {
  const t = normalizeTable(table);
  const index = Math.min(t.rows, Math.max(0, where === 'before' ? at : at + 1));
  const cells = t.cells!.map((row) => [...row]);
  cells.splice(
    index,
    0,
    Array.from({ length: t.cols }, () => ({}) as TableCellData),
  );
  return sanitizeSpans({ ...t, rows: t.rows + 1, cells });
}

/** Insert an empty column before / after column `at` */
export function insertCol(
  table: TableData,
  at: number,
  where: 'before' | 'after' = 'after',
): TableData {
  const t = normalizeTable(table);
  const index = Math.min(t.cols, Math.max(0, where === 'before' ? at : at + 1));
  const cells = t.cells!.map((row) => {
    const next = [...row];
    next.splice(index, 0, {} as TableCellData);
    return next;
  });
  return sanitizeSpans({ ...t, cols: t.cols + 1, cells });
}

/** Delete row `at` (keeps at least 1 row) */
export function removeRow(table: TableData, at: number): TableData {
  const t = normalizeTable(table);
  if (t.rows <= MIN_DIM || at < 0 || at >= t.rows) return t;
  const cells = t.cells!.map((row) => [...row]);
  cells.splice(at, 1);
  return sanitizeSpans({ ...t, rows: t.rows - 1, cells });
}

/** Delete column `at` (keeps at least 1 column) */
export function removeCol(table: TableData, at: number): TableData {
  const t = normalizeTable(table);
  if (t.cols <= MIN_DIM || at < 0 || at >= t.cols) return t;
  const cells = t.cells!.map((row) => {
    const next = [...row];
    next.splice(at, 1);
    return next;
  });
  return sanitizeSpans({ ...t, cols: t.cols - 1, cells });
}

/** Merge: cover rowSpan×colSpan from (row, col) as the top-left corner, clearing covered cells */
export function mergeCells(
  table: TableData,
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
): TableData {
  const t = normalizeTable(table);
  if (t.cells![row]?.[col] === undefined || t.cells![row][col] === null) return t;
  const rs = spanOf(rowSpan, t.rows - row);
  const cs = spanOf(colSpan, t.cols - col);
  return patchCell(t, row, col, {
    rowspan: rs > 1 ? rs : undefined,
    colspan: cs > 1 ? cs : undefined,
  });
}

/** Split: clear the cell's rowspan / colspan (covered cells become empty cells again) */
export function splitCell(table: TableData, row: number, col: number): TableData {
  const t = normalizeTable(table);
  const cell = t.cells?.[row]?.[col];
  if (!cell || (cell.rowspan === undefined && cell.colspan === undefined)) return t;
  const rowSpan = spanOf(cell.rowspan, t.rows - row);
  const colSpan = spanOf(cell.colspan, t.cols - col);
  const cells = t.cells!.map((line) => [...line]);
  const next: TableCellData = { ...cell };
  delete next.rowspan;
  delete next.colspan;
  cells[row][col] = next;
  for (let r = row; r < row + rowSpan; r += 1) {
    for (let c = col; c < col + colSpan; c += 1) {
      if (r === row && c === col) continue;
      cells[r][c] = {};
    }
  }
  return sanitizeSpans({ ...t, cells });
}

/** Render layout: returns only non-covered cells and their geometric spans */
export interface TableCellBox {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  cell: TableCellData;
}

export function computeTableLayout(table: TableData): TableCellBox[] {
  const t = normalizeTable(table);
  const boxes: TableCellBox[] = [];
  for (let r = 0; r < t.rows; r += 1) {
    for (let c = 0; c < t.cols; c += 1) {
      const cell = t.cells![r][c];
      if (cell === null) continue;
      boxes.push({
        row: r,
        col: c,
        rowSpan: spanOf(cell.rowspan, t.rows - r),
        colSpan: spanOf(cell.colspan, t.cols - c),
        cell,
      });
    }
  }
  return boxes;
}

/** Distribute a total length across `count` slots by weight (equal by default) */
function distribute(total: number, weights: number[] | undefined, count: number): number[] {
  const w = Array.from({ length: count }, (_, i) => {
    const v = weights?.[i];
    return typeof v === 'number' && v > 0 ? v : 1;
  });
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((v) => (v / sum) * total);
}

/** Width of each column (pixels) */
export function columnWidths(table: TableData, total: number): number[] {
  const t = normalizeTable(table);
  return distribute(total, t.colWeights, t.cols);
}

/** Height of each row (pixels) */
export function rowHeights(table: TableData, total: number): number[] {
  const t = normalizeTable(table);
  return distribute(total, t.rowWeights, t.rows);
}
