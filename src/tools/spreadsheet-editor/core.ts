import type { ToolResult } from '@/core/types';

/**
 * 电子表格编辑器纯逻辑层（技术设计 §8.2）：
 * 本文件不引入 Univer / exceljs（全部在 xlsx-io.ts 与 univer.ts 中动态导入），
 * 且所有函数遵循 ToolResult 契约——预期错误返回结果而非抛异常。
 */

export type SheetErrorCode =
  | 'EMPTY'
  | 'NOT_XLSX'
  | 'UNSUPPORTED_LEGACY_XLS'
  | 'TOO_LARGE'
  | 'IMPORT_FAILED'
  | 'EXPORT_FAILED'
  | 'SNAPSHOT_FAILED'
  | 'RUNTIME_FAILED';

/** 导入文件大小上限（10MB），与 FileDropZone 保持一致 */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
/** 导入后至少保留的网格规模，避免工作表过小 */
export const MIN_ROW_COUNT = 200;
export const MIN_COLUMN_COUNT = 26;

/** Univer 的 0/1 布尔 */
export type BooleanNumber = 0 | 1;

/** Univer 单元格样式（IStyleData 的精简子集，字段语义与 @univerjs/core 一致） */
export interface UniverStyleLite {
  ff?: string;
  fs?: number;
  it?: BooleanNumber;
  bl?: BooleanNumber;
  ul?: { s: BooleanNumber };
  st?: { s: BooleanNumber };
  cl?: { rgb?: string };
  bg?: { rgb?: string };
  /** HorizontalAlign: 1 左 / 2 中 / 3 右 / 4 两端 */
  ht?: 1 | 2 | 3 | 4;
  /** VerticalAlign: 1 上 / 2 中 / 3 下 */
  vt?: 1 | 2 | 3;
  /** WrapStrategy: 1 overflow / 2 clip / 3 wrap */
  tb?: 1 | 2 | 3;
  n?: { pattern: string };
  bd?: {
    t?: { s: number; cl: { rgb?: string } };
    r?: { s: number; cl: { rgb?: string } };
    b?: { s: number; cl: { rgb?: string } };
    l?: { s: number; cl: { rgb?: string } };
  };
}

/** ExcelJS 单元格样式（仅取本工具关心的字段） */
export interface ExcelStyleLite {
  font?: {
    name?: string;
    size?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean | string;
    strike?: boolean;
    color?: { argb?: string };
  };
  fill?: { type?: string; fgColor?: { argb?: string } };
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean };
  numFmt?: string;
  border?: {
    top?: { style?: string; color?: { argb?: string } };
    bottom?: { style?: string; color?: { argb?: string } };
    left?: { style?: string; color?: { argb?: string } };
    right?: { style?: string; color?: { argb?: string } };
  };
}

export interface MergeRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

/** 0 基列序号 → Excel 列名：0 → A，25 → Z，26 → AA */
export function columnIndexToName(index: number): string {
  if (!Number.isInteger(index) || index < 0) return 'A';
  let n = index;
  let name = '';
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
}

/** Excel 列名 → 0 基列序号：A → 0，AA → 26；非法返回 null */
export function columnNameToIndex(name: string): number | null {
  const text = name.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(text)) return null;
  let index = 0;
  for (const char of text) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

/** 解析 A1 风格坐标："B3" → { row: 2, column: 1 }（均为 0 基） */
export function parseCellRef(ref: string): { row: number; column: number } | null {
  const match = /^([A-Za-z]+)(\d+)$/.exec(ref.trim());
  if (!match) return null;
  const column = columnNameToIndex(match[1]);
  const row = Number(match[2]) - 1;
  if (column === null || row < 0) return null;
  return { row, column };
}

/** 合并区字符串（"A1:C3"）→ 0 基闭区间 */
export function parseMergeRange(range: string): ToolResult<MergeRange> {
  const [startRef, endRef] = range.split(':');
  const start = parseCellRef(startRef ?? '');
  const end = parseCellRef(endRef ?? startRef ?? '');
  if (!start || !end) return { ok: false, error: 'IMPORT_FAILED' };
  return {
    ok: true,
    value: {
      startRow: Math.min(start.row, end.row),
      endRow: Math.max(start.row, end.row),
      startColumn: Math.min(start.column, end.column),
      endColumn: Math.max(start.column, end.column),
    },
  };
}

/** ARGB（FFFF0000）→ Univer 用的 #RRGGBB；alpha 忽略 */
export function argbToHex(argb: string | undefined): string | undefined {
  if (!argb) return undefined;
  const hex = argb.replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{8}$/.test(hex)) return `#${hex.slice(2)}`;
  if (/^[0-9A-F]{6}$/.test(hex)) return `#${hex}`;
  return undefined;
}

/** #RRGGBB → ExcelJS 用的 ARGB（不透明） */
export function hexToArgb(hex: string | undefined): string | undefined {
  if (!hex) return undefined;
  const value = hex.replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{6}$/.test(value)) return `FF${value}`;
  if (/^[0-9A-F]{8}$/.test(value)) return value;
  return undefined;
}

export type ImportKind = 'xlsx' | 'legacy-xls' | 'unsupported';

/** 依据扩展名判定可导入类型；旧版 .xls（BIFF 二进制）浏览器端不解析 */
export function resolveImportKind(filename: string): ImportKind {
  const lower = filename.trim().toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) return 'xlsx';
  if (lower.endsWith('.xls') || lower.endsWith('.et') || lower.endsWith('.csv')) {
    return 'legacy-xls';
  }
  return 'unsupported';
}

/** 导入前统一校验：格式 + 体积 */
export function checkImportFile(file: { name: string; size: number }): ToolResult<'xlsx'> {
  const kind = resolveImportKind(file.name);
  if (kind === 'legacy-xls') return { ok: false, error: 'UNSUPPORTED_LEGACY_XLS' };
  if (kind !== 'xlsx') return { ok: false, error: 'NOT_XLSX' };
  if (file.size > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      error: 'TOO_LARGE',
      params: { max: Math.round(MAX_IMPORT_BYTES / 1024 / 1024) },
    };
  }
  return { ok: true, value: 'xlsx' };
}

const HORIZONTAL_TO_UNIVER: Record<string, 1 | 2 | 3 | 4> = {
  left: 1,
  center: 2,
  right: 3,
  justify: 4,
};
const VERTICAL_TO_UNIVER: Record<string, 1 | 2 | 3> = { top: 1, middle: 2, bottom: 3 };
const HORIZONTAL_TO_EXCEL: Record<number, string> = {
  1: 'left',
  2: 'center',
  3: 'right',
  4: 'justify',
};
const VERTICAL_TO_EXCEL: Record<number, string> = { 1: 'top', 2: 'middle', 3: 'bottom' };

/** ExcelJS 边框线型 → Univer BorderStyleTypes */
const BORDER_TO_UNIVER: Record<string, number> = {
  hair: 2,
  dotted: 3,
  dashed: 4,
  dashDot: 5,
  dashDotDot: 6,
  double: 7,
  medium: 8,
  mediumDashed: 9,
  mediumDashDot: 10,
  mediumDashDotDot: 11,
  slantDashDot: 12,
  thick: 13,
};
const BORDER_TO_EXCEL: Record<number, string> = {
  1: 'thin',
  2: 'hair',
  3: 'dotted',
  4: 'dashed',
  5: 'dashDot',
  6: 'dashDotDot',
  7: 'double',
  8: 'medium',
  9: 'mediumDashed',
  10: 'mediumDashDot',
  11: 'mediumDashDotDot',
  12: 'slantDashDot',
  13: 'thick',
};

function toUniverBorder(side: { style?: string; color?: { argb?: string } } | undefined) {
  if (!side?.style) return undefined;
  const s = BORDER_TO_UNIVER[side.style] ?? 1;
  const rgb = argbToHex(side.color?.argb);
  return { s, cl: rgb ? { rgb } : {} };
}

function toExcelBorder(side: { s: number; cl: { rgb?: string } } | undefined) {
  if (!side) return undefined;
  return {
    style: BORDER_TO_EXCEL[side.s] ?? 'thin',
    color: { argb: hexToArgb(side.cl?.rgb) ?? 'FF000000' },
  };
}

/** ExcelJS 样式 → Univer 样式（仅覆盖字体/字号/粗斜体/下划线/删除线/字色/背景/对齐/换行/数字格式/边框） */
export function excelStyleToUniver(style: ExcelStyleLite): UniverStyleLite {
  const out: UniverStyleLite = {};
  const font = style.font;
  if (font?.name) out.ff = font.name;
  if (typeof font?.size === 'number') out.fs = font.size;
  if (font?.bold) out.bl = 1;
  if (font?.italic) out.it = 1;
  if (font?.underline) out.ul = { s: 1 };
  if (font?.strike) out.st = { s: 1 };
  const fontColor = argbToHex(font?.color?.argb);
  if (fontColor) out.cl = { rgb: fontColor };

  const fill = style.fill;
  if (fill?.type === 'pattern' || fill?.type === 'gradient') {
    const bg = argbToHex(fill.fgColor?.argb);
    if (bg) out.bg = { rgb: bg };
  }

  const align = style.alignment;
  if (align?.horizontal) {
    const ht = HORIZONTAL_TO_UNIVER[align.horizontal];
    if (ht) out.ht = ht;
  }
  if (align?.vertical) {
    const vt = VERTICAL_TO_UNIVER[align.vertical];
    if (vt) out.vt = vt;
  }
  if (align?.wrapText) out.tb = 3;

  if (style.numFmt && style.numFmt !== 'General') out.n = { pattern: style.numFmt };

  const border = style.border;
  const bd = {
    t: toUniverBorder(border?.top),
    r: toUniverBorder(border?.right),
    b: toUniverBorder(border?.bottom),
    l: toUniverBorder(border?.left),
  };
  if (bd.t || bd.r || bd.b || bd.l) out.bd = bd;

  return out;
}

/** Univer 样式 → ExcelJS 样式 */
export function univerStyleToExcel(style: UniverStyleLite): ExcelStyleLite {
  const out: ExcelStyleLite = {};
  const font: NonNullable<ExcelStyleLite['font']> = {};
  if (style.ff) font.name = style.ff;
  if (typeof style.fs === 'number') font.size = style.fs;
  if (style.bl) font.bold = true;
  if (style.it) font.italic = true;
  if (style.ul?.s) font.underline = true;
  if (style.st?.s) font.strike = true;
  const fontColor = hexToArgb(style.cl?.rgb);
  if (fontColor) font.color = { argb: fontColor };
  if (Object.keys(font).length > 0) out.font = font;

  const bg = hexToArgb(style.bg?.rgb);
  if (bg) out.fill = { type: 'pattern', fgColor: { argb: bg } };

  const alignment: NonNullable<ExcelStyleLite['alignment']> = {};
  if (style.ht) {
    const horizontal = HORIZONTAL_TO_EXCEL[style.ht];
    if (horizontal) alignment.horizontal = horizontal;
  }
  if (style.vt) {
    const vertical = VERTICAL_TO_EXCEL[style.vt];
    if (vertical) alignment.vertical = vertical;
  }
  if (style.tb === 3) alignment.wrapText = true;
  if (Object.keys(alignment).length > 0) out.alignment = alignment;

  if (style.n?.pattern) out.numFmt = style.n.pattern;

  const bd = style.bd;
  if (bd) {
    const border: NonNullable<ExcelStyleLite['border']> = {};
    const top = toExcelBorder(bd.t);
    if (top) border.top = top;
    const bottom = toExcelBorder(bd.b);
    if (bottom) border.bottom = bottom;
    const left = toExcelBorder(bd.l);
    if (left) border.left = left;
    const right = toExcelBorder(bd.r);
    if (right) border.right = right;
    if (Object.keys(border).length > 0) out.border = border;
  }

  return out;
}

/** 工作簿快照（供统计使用的精简视图，字段与 Univer IWorkbookData 对齐） */
export interface WorkbookSnapshotLite {
  sheetOrder?: string[];
  sheets?: Record<
    string,
    { name?: string; cellData?: Record<string, Record<string, { v?: unknown; f?: unknown }>> }
  >;
}

export interface WorkbookSummary {
  sheets: number;
  rows: number;
  columns: number;
  cells: number;
  formulas: number;
}

/** 统计工作簿规模：工作表数 / 最大行 / 最大列 / 非空单元格数 / 公式数 */
export function summarizeWorkbook(snapshot: WorkbookSnapshotLite): WorkbookSummary {
  const sheetIds = snapshot.sheetOrder?.length
    ? snapshot.sheetOrder
    : Object.keys(snapshot.sheets ?? {});
  let rows = 0;
  let columns = 0;
  let cells = 0;
  let formulas = 0;
  for (const id of sheetIds) {
    const sheet = snapshot.sheets?.[id];
    if (!sheet) continue;
    for (const [rowKey, rowCells] of Object.entries(sheet.cellData ?? {})) {
      const rowIndex = Number(rowKey);
      if (Number.isFinite(rowIndex)) rows = Math.max(rows, rowIndex + 1);
      for (const [colKey, cell] of Object.entries(rowCells ?? {})) {
        const colIndex = Number(colKey);
        if (Number.isFinite(colIndex)) columns = Math.max(columns, colIndex + 1);
        const value = cell?.v ?? cell?.f;
        if (value !== undefined && value !== null && value !== '') cells += 1;
        if (cell?.f) formulas += 1;
      }
    }
  }
  return { sheets: sheetIds.length, rows, columns, cells, formulas };
}

/* ------------------------------ 放映（只读表格） ------------------------------ */

/** 放映最多展示的行 / 列：超出只提示截断，避免把 DOM 撑爆 */
export const PRESENT_MAX_ROWS = 120;
export const PRESENT_MAX_COLS = 30;

/** 空工作簿放映时的空白网格规模（看起来像一张空表，而不是孤零零一个单元格） */
export const PRESENT_BLANK_ROWS = 16;
export const PRESENT_BLANK_COLS = 8;

export interface PresentCell {
  row: number;
  col: number;
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  color?: string;
  background?: string;
  align?: 'left' | 'center' | 'right';
}

export interface PresentMerge {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

export interface PresentGrid {
  sheetName: string;
  rows: number;
  cols: number;
  cells: PresentCell[];
  merges: PresentMerge[];
  /** 内容超出展示上限（行列被截断） */
  truncated: boolean;
}

function alignOf(style: UniverStyleLite | undefined): PresentCell['align'] {
  if (style?.ht === 2) return 'center';
  if (style?.ht === 3) return 'right';
  if (style?.ht === 1) return 'left';
  return undefined;
}

/**
 * 快照 → 只读表格数据（纯函数，便于单测）。
 * 用于「放映」模式：不依赖 Univer 实例，直接渲染成 HTML 表格。
 */
export function buildPresentGrid(
  snapshot: WorkbookSnapshotLite,
  sheetId: string | null,
  maxRows = PRESENT_MAX_ROWS,
  maxCols = PRESENT_MAX_COLS,
): PresentGrid | null {
  const withData = (id: string) => {
    const sheet = snapshot.sheets?.[id];
    if (!sheet) return { rows: 0, cols: 0 };
    let rows = 0;
    let cols = 0;
    for (const [rowKey, rowCells] of Object.entries(sheet.cellData ?? {})) {
      const rowIndex = Number(rowKey);
      if (!Number.isFinite(rowIndex)) continue;
      rows = Math.max(rows, rowIndex + 1);
      for (const colKey of Object.keys(rowCells ?? {})) {
        const colIndex = Number(colKey);
        if (Number.isFinite(colIndex)) cols = Math.max(cols, colIndex + 1);
      }
    }
    return { rows, cols };
  };

  const order = snapshot.sheetOrder?.length
    ? snapshot.sheetOrder
    : Object.keys(snapshot.sheets ?? {});
  // 指定的工作表为空时，回退到第一张有内容的表
  const target =
    sheetId && snapshot.sheets?.[sheetId]
      ? sheetId
      : (order.find((id) => withData(id).rows > 0) ?? order[0] ?? null);
  if (!target) return null;
  const sheet = snapshot.sheets?.[target];
  if (!sheet) return null;

  const used = withData(target);
  // 有内容就按内容范围展示；完全空的工作簿给一张空白网格，避免只剩一个单元格
  const hasData = used.rows > 0 || used.cols > 0;
  const rows = hasData ? Math.max(1, Math.min(used.rows, maxRows)) : PRESENT_BLANK_ROWS;
  const cols = hasData ? Math.max(1, Math.min(used.cols, maxCols)) : PRESENT_BLANK_COLS;
  const cells: PresentCell[] = [];

  for (const [rowKey, rowCells] of Object.entries(sheet.cellData ?? {})) {
    const row = Number(rowKey);
    if (!Number.isFinite(row) || row >= rows) continue;
    for (const [colKey, cell] of Object.entries(rowCells ?? {})) {
      const col = Number(colKey);
      if (!Number.isFinite(col) || col >= cols) continue;
      const value = cell?.v ?? cell?.f;
      if (value === undefined || value === null || value === '') continue;
      const text =
        cell?.f && (cell.v === undefined || cell.v === null) ? `=${cell.f}` : String(value);
      const style = (cell as { s?: UniverStyleLite }).s;
      cells.push({
        row,
        col,
        text,
        ...(style?.bl === 1 ? { bold: true } : {}),
        ...(style?.it === 1 ? { italic: true } : {}),
        ...(style?.ul?.s === 1 ? { underline: true } : {}),
        ...(style?.fs !== undefined ? { fontSize: Math.round(style.fs) } : {}),
        ...(style?.cl?.rgb ? { color: style.cl.rgb } : {}),
        ...(style?.bg?.rgb ? { background: style.bg.rgb } : {}),
        ...(alignOf(style) ? { align: alignOf(style) } : {}),
      });
    }
  }

  const merges: PresentMerge[] = ((sheet as { mergeData?: MergeRange[] }).mergeData ?? [])
    .filter((range) => range.startRow < rows && range.startColumn < cols)
    .map((range) => ({
      row: range.startRow,
      col: range.startColumn,
      rowSpan: Math.max(1, Math.min(range.endRow, rows - 1) - range.startRow + 1),
      colSpan: Math.max(1, Math.min(range.endColumn, cols - 1) - range.startColumn + 1),
    }));

  return {
    sheetName: sheet.name ?? '',
    rows,
    cols,
    // 按行列排序，便于渲染时按顺序填充
    cells: cells.sort((a, b) => a.row - b.row || a.col - b.col),
    merges,
    truncated: used.rows > rows || used.cols > cols,
  };
}

/** 清洗非法文件名字符并限制长度 */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 60) || 'workbook';
}

/** 生成导出文件名 */
export function buildExportFilename(title: string, ext: 'xlsx'): string {
  return `${sanitizeFilename(title)}.${ext}`;
}

/** 列宽单位换算：Univer 用像素，ExcelJS 用字符宽度（1 字符 ≈ 7px） */
export function pxToColumnWidth(px: number | undefined): number | undefined {
  if (!px || px <= 0) return undefined;
  return Math.max(1, Math.round((px / 7) * 100) / 100);
}

export function columnWidthToPx(width: number | undefined): number | undefined {
  if (!width || width <= 0) return undefined;
  return Math.round(width * 7);
}

/** 行高单位换算：Univer 用像素，ExcelJS 用磅（1pt ≈ 1.333px） */
export function pxToRowHeight(px: number | undefined): number | undefined {
  if (!px || px <= 0) return undefined;
  return Math.max(1, Math.round((px / 1.3333) * 100) / 100);
}

export function rowHeightToPx(pts: number | undefined): number | undefined {
  if (!pts || pts <= 0) return undefined;
  return Math.round(pts * 1.3333);
}
