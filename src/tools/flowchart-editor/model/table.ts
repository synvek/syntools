/**
 * 表格节点的纯逻辑：结构归一、单元格读写、行列增删、合并 / 拆分与渲染布局计算。
 * 不引用 React / DOM，便于单测与在 store / 节点渲染中复用。
 *
 * 数据约定：`cells[row][col]` 为单元格；被合并覆盖的从属单元格记为 `null`，
 * 仅合并区域左上角保留内容与 span。
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

/** 新建空表格 */
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
 * 结构归一：行列数合法，`cells` 补齐为 rows×cols。
 * 源中显式 `null`（被合并覆盖）保留，缺失的格补空单元格。
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
 * 让 span 与结构自洽：把越界 span 夹到边界内，并据此重算从属格（被覆盖为 null）。
 * 行列增删后调用，避免出现悬空合并。
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
      // 已被上方 / 左侧合并区域覆盖的格子跳过（先到先得）
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

/** 读取单元格（越界或从属格返回空对象） */
export function cellAt(table: TableData, row: number, col: number): TableCellData {
  const t = normalizeTable(table);
  const cell = t.cells?.[row]?.[col];
  return cell ?? {};
}

/** 局部更新单元格（从属格与越界位置不生效） */
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

/** 写入单元格文本 */
export function setCellText(table: TableData, row: number, col: number, text: string): TableData {
  return patchCell(table, row, col, { text });
}

/** 在 `at` 行前 / 后插入空行 */
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

/** 在 `at` 列前 / 后插入空列 */
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

/** 删除 `at` 行（至少保留 1 行） */
export function removeRow(table: TableData, at: number): TableData {
  const t = normalizeTable(table);
  if (t.rows <= MIN_DIM || at < 0 || at >= t.rows) return t;
  const cells = t.cells!.map((row) => [...row]);
  cells.splice(at, 1);
  return sanitizeSpans({ ...t, rows: t.rows - 1, cells });
}

/** 删除 `at` 列（至少保留 1 列） */
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

/** 合并：以 (row, col) 为左上角覆盖 rowSpan×colSpan，从属格置空 */
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

/** 拆分：清除该单元格的 rowspan / colspan（从属格恢复为空单元格） */
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

/** 渲染布局：仅返回非从属单元格及其几何跨度 */
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

/** 按权重把总长分配到 count 段（缺省等分） */
function distribute(total: number, weights: number[] | undefined, count: number): number[] {
  const w = Array.from({ length: count }, (_, i) => {
    const v = weights?.[i];
    return typeof v === 'number' && v > 0 ? v : 1;
  });
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((v) => (v / sum) * total);
}

/** 各列宽度（像素） */
export function columnWidths(table: TableData, total: number): number[] {
  const t = normalizeTable(table);
  return distribute(total, t.colWeights, t.cols);
}

/** 各行高度（像素） */
export function rowHeights(table: TableData, total: number): number[] {
  const t = normalizeTable(table);
  return distribute(total, t.rowWeights, t.rows);
}
