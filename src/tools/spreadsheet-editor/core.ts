import type { ToolResult } from '@/core/types';

/**
 * Spreadsheet editor pure-logic layer (technical design §8.2):
 * This file imports neither Univer nor exceljs (both are dynamically imported in xlsx-io.ts and
 * univer.ts), and every function follows the ToolResult contract — expected errors are returned,
 * never thrown.
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

/** Import file size cap (10MB), matching FileDropZone */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
/** Minimum grid size kept after import so the sheet never looks too small */
export const MIN_ROW_COUNT = 200;
export const MIN_COLUMN_COUNT = 26;

/** Univer's 0/1 boolean */
export type BooleanNumber = 0 | 1;

/** Univer cell style (a trimmed subset of IStyleData; field semantics match @univerjs/core) */
export interface UniverStyleLite {
  ff?: string;
  fs?: number;
  it?: BooleanNumber;
  bl?: BooleanNumber;
  ul?: { s: BooleanNumber };
  st?: { s: BooleanNumber };
  cl?: { rgb?: string };
  bg?: { rgb?: string };
  /** HorizontalAlign: 1 left / 2 center / 3 right / 4 justify */
  ht?: 1 | 2 | 3 | 4;
  /** VerticalAlign: 1 top / 2 middle / 3 bottom */
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

/** ExcelJS cell style (only the fields this tool cares about) */
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

/** Rich text piece (font subset aligned with ExcelJS RichText) */
export interface RichTextPiece {
  text: string;
  font?: {
    name?: string;
    size?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean | string;
    strike?: boolean;
    color?: { argb?: string };
  };
}

/**
 * Univer cell rich-text document data (the minimal shape of ICellData.p).
 * Univer keeps p verbatim (verified by a probe run before implementation), so it can safely carry
 * partial formatting from an Excel cell.
 */
export interface CellDocumentData {
  id: string;
  body: {
    dataStream: string;
    textRuns: { st: number; ed: number; ts: UniverStyleLite }[];
    paragraphs: { startIndex: number }[];
    sectionBreaks: { startIndex: number }[];
  };
  documentStyle: Record<string, never>;
}

/**
 * Extra per-cell payload, stored in Univer's ICellData.custom (Univer keeps the field verbatim).
 * It currently carries hyperlink / note / error-value semantics for the UI (P1) and for export.
 */
export interface CellCustomPayload {
  /** Hyperlink target and optional display text */
  hyperlink?: { url: string; text?: string };
  /** Comment / note text */
  note?: string;
  /** Error value text (e.g. #VALUE!): restored as an Excel error cell on export */
  error?: string;
}

export interface MergeRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

/** 0-based column index → Excel column name: 0 → A, 25 → Z, 26 → AA */
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

/** Excel column name → 0-based index: A → 0, AA → 26; returns null when invalid */
export function columnNameToIndex(name: string): number | null {
  const text = name.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(text)) return null;
  let index = 0;
  for (const char of text) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

/** Parse an A1-style reference: "B3" → { row: 2, column: 1 } (both 0-based) */
export function parseCellRef(ref: string): { row: number; column: number } | null {
  const match = /^([A-Za-z]+)(\d+)$/.exec(ref.trim());
  if (!match) return null;
  const column = columnNameToIndex(match[1]);
  const row = Number(match[2]) - 1;
  if (column === null || row < 0) return null;
  return { row, column };
}

/** Merge range string ("A1:C3") → 0-based inclusive bounds */
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

/** ARGB (FFFF0000) → #RRGGBB for Univer; alpha is dropped */
export function argbToHex(argb: string | undefined): string | undefined {
  if (!argb) return undefined;
  const hex = argb.replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{8}$/.test(hex)) return `#${hex.slice(2)}`;
  if (/^[0-9A-F]{6}$/.test(hex)) return `#${hex}`;
  return undefined;
}

/** #RRGGBB → ARGB for ExcelJS (fully opaque) */
export function hexToArgb(hex: string | undefined): string | undefined {
  if (!hex) return undefined;
  const value = hex.replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{6}$/.test(value)) return `FF${value}`;
  if (/^[0-9A-F]{8}$/.test(value)) return value;
  return undefined;
}

export type ImportKind = 'xlsx' | 'csv' | 'legacy-xls' | 'unsupported';

/** Decide the importable type from the extension; legacy .xls (BIFF binary) is not parsed in the browser */
export function resolveImportKind(filename: string): ImportKind {
  const lower = filename.trim().toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) return 'xlsx';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xls') || lower.endsWith('.et')) return 'legacy-xls';
  return 'unsupported';
}

/** Single pre-import check: format and size */
export function checkImportFile(file: { name: string; size: number }): ToolResult<'xlsx' | 'csv'> {
  const kind = resolveImportKind(file.name);
  if (kind === 'legacy-xls') return { ok: false, error: 'UNSUPPORTED_LEGACY_XLS' };
  if (kind === 'unsupported') return { ok: false, error: 'NOT_XLSX' };
  if (file.size > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      error: 'TOO_LARGE',
      params: { max: Math.round(MAX_IMPORT_BYTES / 1024 / 1024) },
    };
  }
  return { ok: true, value: kind };
}

/* ------------------------------ Sheet structure fidelity ------------------------------ */

/** Excel sheet visibility → Univer hidden flag (both hidden and veryHidden normalise to hidden) */
export function worksheetStateToHidden(state: string | undefined): BooleanNumber {
  return state === 'hidden' || state === 'veryHidden' ? 1 : 0;
}

/** Univer hidden flag → Excel sheet visibility */
export function hiddenToWorksheetState(hidden: BooleanNumber | undefined): 'visible' | 'hidden' {
  return hidden ? 'hidden' : 'visible';
}

/**
 * Excel view boolean (showGridLines / rightToLeft, …) → Univer 0/1.
 * Falls back when the field is absent, so "unset" is not mistaken for false and the default look
 * stays intact.
 */
export function viewFlagToBooleanNumber(
  value: boolean | undefined,
  fallback: BooleanNumber,
): BooleanNumber {
  if (typeof value !== 'boolean') return fallback;
  return value ? 1 : 0;
}

/** Univer 0/1 → Excel view boolean */
export function booleanNumberToViewFlag(value: BooleanNumber | undefined): boolean {
  return value === 1;
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

/** ExcelJS border style → Univer BorderStyleTypes */
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

/** ExcelJS style → Univer style (only font / size / bold-italic / underline / strike / colour /
 * background / alignment / wrap / number format / borders) */
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

/** Univer style → ExcelJS style */
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

/* ------------------------------ Cell rich text / dates / custom payload ------------------------------ */

/** Rich-text font subset → Univer text style (same fields as cell styles, so rendering can be reused) */
export function richTextFontToStyle(font: RichTextPiece['font'] | undefined): UniverStyleLite {
  const out: UniverStyleLite = {};
  if (!font) return out;
  if (font.name) out.ff = font.name;
  if (typeof font.size === 'number') out.fs = font.size;
  if (font.bold) out.bl = 1;
  if (font.italic) out.it = 1;
  if (font.underline) out.ul = { s: 1 };
  if (font.strike) out.st = { s: 1 };
  const color = argbToHex(font.color?.argb);
  if (color) out.cl = { rgb: color };
  return out;
}

/** Univer text style → rich-text font subset (for export; undefined when there is no style) */
export function styleToRichTextFont(style: UniverStyleLite | undefined): RichTextPiece['font'] {
  if (!style) return undefined;
  const font: NonNullable<RichTextPiece['font']> = {};
  if (style.ff) font.name = style.ff;
  if (typeof style.fs === 'number') font.size = style.fs;
  if (style.bl) font.bold = true;
  if (style.it) font.italic = true;
  if (style.ul?.s) font.underline = true;
  if (style.st?.s) font.strike = true;
  const color = hexToArgb(style.cl?.rgb);
  if (color) font.color = { argb: color };
  return Object.keys(font).length > 0 ? font : undefined;
}

/**
 * ExcelJS richText pieces → Univer cell rich text (ICellData.p).
 * Returns null when no style is worth keeping, in which case callers should just use plain text.
 */
export function richTextToCellDocument(
  pieces: readonly RichTextPiece[],
  id: string,
): CellDocumentData | null {
  const text = pieces.map((piece) => piece.text ?? '').join('');
  if (!text) return null;
  const textRuns: CellDocumentData['body']['textRuns'] = [];
  let cursor = 0;
  for (const piece of pieces) {
    const length = (piece.text ?? '').length;
    const ts = richTextFontToStyle(piece.font);
    if (length > 0 && Object.keys(ts).length > 0) {
      textRuns.push({ st: cursor, ed: cursor + length, ts });
    }
    cursor += length;
  }
  if (textRuns.length === 0) return null;
  return {
    id,
    body: {
      dataStream: `${text}\r\n`,
      textRuns,
      paragraphs: [{ startIndex: cursor }],
      sectionBreaks: [{ startIndex: cursor + 1 }],
    },
    documentStyle: {},
  };
}

/** Univer cell rich text → ExcelJS richText pieces (for export; split at text-run boundaries) */
export function cellDocumentToRichText(doc: CellDocumentData): RichTextPiece[] {
  const text = (doc.body?.dataStream ?? '').replace(/\r\n$/, '');
  const runs = doc.body?.textRuns ?? [];
  if (!text) return [];
  if (runs.length === 0) return [{ text }];
  const boundaries = new Set<number>([0, text.length]);
  for (const run of runs) {
    boundaries.add(Math.max(0, Math.min(text.length, run.st)));
    boundaries.add(Math.max(0, Math.min(text.length, run.ed)));
  }
  const points = [...boundaries].sort((a, b) => a - b);
  const pieces: RichTextPiece[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (end <= start) continue;
    const run = runs.find((item) => item.st <= start && item.ed >= end);
    const font = styleToRichTextFont(run?.ts);
    const piece: RichTextPiece = { text: text.slice(start, end) };
    if (font) piece.font = font;
    pieces.push(piece);
  }
  return pieces;
}

/** Excel 1900 date system: Date → serial (the exact inverse of ExcelJS's excelToDate) */
export function dateToExcelSerial(date: Date): number {
  return 25569 + date.getTime() / 86_400_000;
}

/** Excel serial → Date (1900 date system; inverse of dateToExcelSerial) */
export function excelSerialToDate(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86_400_000));
}

/** Unicode BOM, prepended on CSV export so Excel detects UTF-8 Chinese text correctly */
export const CSV_BOM = '\ufeff';

/** Workbook snapshot (a trimmed view for statistics; fields aligned with Univer IWorkbookData) */
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

/** Summarise workbook size: sheets / max rows / max columns / non-empty cells / formulas */
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

/* ------------------------------ Present mode (read-only grid) ------------------------------ */

/** Max rows / columns rendered in present mode; beyond that we only flag truncation so the DOM stays small */
export const PRESENT_MAX_ROWS = 120;
export const PRESENT_MAX_COLS = 30;

/** Blank grid size when presenting an empty workbook (looks like an empty table, not one lonely cell) */
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
  /** Content exceeds the display cap (rows/columns truncated) */
  truncated: boolean;
}

function alignOf(style: UniverStyleLite | undefined): PresentCell['align'] {
  if (style?.ht === 2) return 'center';
  if (style?.ht === 3) return 'right';
  if (style?.ht === 1) return 'left';
  return undefined;
}

/**
 * Snapshot → read-only grid data (a pure function, easy to unit test).
 * Used by present mode: renders straight to an HTML table without a Univer instance.
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
  // Fall back to the first non-empty sheet when the requested one is empty
  const target =
    sheetId && snapshot.sheets?.[sheetId]
      ? sheetId
      : (order.find((id) => withData(id).rows > 0) ?? order[0] ?? null);
  if (!target) return null;
  const sheet = snapshot.sheets?.[target];
  if (!sheet) return null;

  const used = withData(target);
  // Render the used range when there is content; a fully empty workbook gets a blank grid rather than a single cell
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
      const formula = typeof cell?.f === 'string' ? cell.f : '';
      // Per Univer, formulas in the snapshot already carry a leading "=", so do not add another
      const text =
        formula && (cell.v === undefined || cell.v === null)
          ? formula.startsWith('=')
            ? formula
            : `=${formula}`
          : String(value);
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
    // Sort by row then column so rendering can fill cells in order
    cells: cells.sort((a, b) => a.row - b.row || a.col - b.col),
    merges,
    truncated: used.rows > rows || used.cols > cols,
  };
}

/** Strip illegal filename characters and cap the length */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 60) || 'workbook';
}

/** Build the export filename */
export function buildExportFilename(title: string, ext: 'xlsx' | 'csv'): string {
  return `${sanitizeFilename(title)}.${ext}`;
}

/** Column width conversion: Univer uses pixels, ExcelJS uses character widths (1 char ≈ 7px) */
export function pxToColumnWidth(px: number | undefined): number | undefined {
  if (!px || px <= 0) return undefined;
  return Math.max(1, Math.round((px / 7) * 100) / 100);
}

export function columnWidthToPx(width: number | undefined): number | undefined {
  if (!width || width <= 0) return undefined;
  return Math.round(width * 7);
}

/** Row height conversion: Univer uses pixels, ExcelJS uses points (1pt ≈ 1.333px) */
export function pxToRowHeight(px: number | undefined): number | undefined {
  if (!px || px <= 0) return undefined;
  return Math.max(1, Math.round((px / 1.3333) * 100) / 100);
}

export function rowHeightToPx(pts: number | undefined): number | undefined {
  if (!pts || pts <= 0) return undefined;
  return Math.round(pts * 1.3333);
}
