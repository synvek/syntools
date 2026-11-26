import type { ToolResult } from '@/core/types';
import { resolveThemeColor, type ThemePalette } from './xlsx-theme';

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
  | 'RUNTIME_FAILED'
  /*
   * Import diagnosis (P0-2): "the file could not be read" is not one situation. Each code below
   * leads to a different user action (remove the password / re-download / use another producer),
   * so they are separate codes rather than one message with a detail string.
   */
  | 'FILE_ENCRYPTED'
  | 'NOT_ZIP'
  | 'MISSING_WORKBOOK_PART'
  | 'PART_UNREADABLE';

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
  /** ITextDecoration: `t` selects the line type (see TEXT_DECORATION_SINGLE / _DOUBLE) */
  ul?: { s: BooleanNumber; t?: number };
  st?: { s: BooleanNumber };
  cl?: { rgb?: string };
  bg?: { rgb?: string };
  /** BaselineOffset: 2 subscript / 3 superscript (drawn smaller and shifted by engine-render) */
  va?: 2 | 3;
  /** Text rotation: `a` in degrees (negative = counter-clockwise, i.e. Excel's 1-90), `v: 1` = vertical text */
  tr?: { a: number; v?: BooleanNumber };
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

/** ExcelJS colour reference: either a concrete ARGB or a slot in the workbook theme */
export interface ExcelColorLike {
  argb?: string;
  theme?: number;
  tint?: number;
}

/** ExcelJS font subset (only the fields this tool cares about) */
export interface ExcelFontLite {
  name?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean | string;
  strike?: boolean;
  /** superscript / subscript — Excel keeps them as a font attribute, not as separate characters */
  vertAlign?: string;
  color?: ExcelColorLike;
}

/** ExcelJS cell style (only the fields this tool cares about) */
export interface ExcelStyleLite {
  font?: ExcelFontLite;
  fill?: { type?: string; fgColor?: ExcelColorLike };
  alignment?: {
    horizontal?: string;
    vertical?: string;
    wrapText?: boolean;
    /** Degrees counter-clockwise (1-90) / clockwise (91-180), or the literal 'vertical' for 255 */
    textRotation?: number | string;
    shrinkToFit?: boolean;
  };
  numFmt?: string;
  border?: {
    top?: { style?: string; color?: ExcelColorLike };
    bottom?: { style?: string; color?: ExcelColorLike };
    left?: { style?: string; color?: ExcelColorLike };
    right?: { style?: string; color?: ExcelColorLike };
  };
}

/** Rich text piece (font subset aligned with ExcelJS RichText) */
export interface RichTextPiece {
  text: string;
  font?: ExcelFontLite;
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
  /**
   * Shrink-to-fit ("缩小字体填充"): the engine cannot shrink glyphs, so import stores the size Excel
   * computed here and lowers the cell font to it. `fs` keeps the authored size for export, which writes
   * the original size plus `<alignment shrinkToFit="1"/>` so Excel still shrinks it itself.
   */
  shrinkToFit?: { fs: number };
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

/**
 * ExcelJS colour → #RRGGBB, resolving `theme` references against the workbook palette.
 * A theme colour that cannot be resolved is dropped rather than guessed: painting the wrong colour is
 * worse than leaving the default, and importFidelity reports nothing for it either way.
 */
export function excelColorToHex(
  color: ExcelColorLike | undefined,
  palette?: ThemePalette,
): string | undefined {
  if (!color) return undefined;
  const direct = argbToHex(color.argb);
  if (direct) return direct;
  return resolveThemeColor(palette, color.theme, color.tint);
}

/** Univer text-decoration line types (shared by underline and strike) */
export const TEXT_DECORATION_SINGLE = 12;
export const TEXT_DECORATION_DOUBLE = 10;

/** Univer BaselineOffset: superscript / subscript */
export const BASELINE_SUBSCRIPT = 2;
export const BASELINE_SUPERSCRIPT = 3;

/**
 * Excel underline → Univer text decoration.
 * Excel has four variants; Univer only knows single and double, so the two "accounting" forms keep
 * their line type and lose the accounting gap (still better than dropping the underline entirely).
 */
export function underlineToUniver(
  underline: boolean | string | undefined,
): { s: BooleanNumber; t?: number } | undefined {
  if (!underline) return undefined;
  const value = underline === true ? 'single' : String(underline).toLowerCase();
  return value.startsWith('double') ? { s: 1, t: TEXT_DECORATION_DOUBLE } : { s: 1 };
}

/** Univer underline → Excel's `underline` attribute */
export function univerUnderlineToExcel(ul: UniverStyleLite['ul']): boolean | 'double' | undefined {
  if (!ul?.s) return undefined;
  return ul.t === TEXT_DECORATION_DOUBLE ? 'double' : true;
}

/** Excel `vertAlign` → Univer BaselineOffset (only the two baseline-shifted modes matter) */
export function vertAlignToUniver(vertAlign: string | undefined): 2 | 3 | undefined {
  const value = vertAlign?.toLowerCase();
  if (value === 'superscript') return BASELINE_SUPERSCRIPT;
  if (value === 'subscript') return BASELINE_SUBSCRIPT;
  return undefined;
}

/** Univer BaselineOffset → Excel `vertAlign` */
export function univerVertAlignToExcel(
  va: UniverStyleLite['va'],
): 'superscript' | 'subscript' | undefined {
  if (va === BASELINE_SUPERSCRIPT) return 'superscript';
  if (va === BASELINE_SUBSCRIPT) return 'subscript';
  return undefined;
}

/**
 * Excel text rotation → Univer text rotation.
 * Excel counts counter-clockwise in 1-90 and clockwise in 91-180 (as `n - 90`), and 255 means the text is
 * laid out vertically top-to-bottom. Univer uses the opposite sign for counter-clockwise and a flag for
 * the vertical case (see its own rotate menu: -45 = angle up, 45 = angle down).
 */
export function textRotationToUniver(
  value: number | string | undefined,
): { a: number; v?: BooleanNumber } | undefined {
  if (value === 'vertical' || value === 255) return { a: 0, v: 1 };
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < 1 || value > 180) return undefined;
  return value <= 90 ? { a: -value } : { a: value - 90 };
}

/** Univer text rotation → Excel `textRotation` */
export function univerTextRotationToExcel(
  tr: UniverStyleLite['tr'],
): number | 'vertical' | undefined {
  if (!tr) return undefined;
  if (tr.v === 1) return 'vertical';
  if (typeof tr.a !== 'number' || !Number.isFinite(tr.a) || tr.a === 0) return undefined;
  return tr.a < 0 ? Math.min(90, Math.round(-tr.a)) : Math.min(180, Math.round(90 + tr.a));
}

export type ImportKind = 'xlsx' | 'csv' | 'ods' | 'legacy-xls' | 'unsupported';

/**
 * Decide the importable type from the extension; legacy .xls (BIFF binary) is not parsed in the browser.
 * `.fods`（flat ODS，单个 XML 而不是 zip）**不认**：它走的是另一条解析路径，混进来只会报
 * "解析失败"，不如明确留在 unsupported 里。
 */
export function resolveImportKind(filename: string): ImportKind {
  const lower = filename.trim().toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) return 'xlsx';
  if (lower.endsWith('.ods')) return 'ods';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xls') || lower.endsWith('.et')) return 'legacy-xls';
  return 'unsupported';
}

/** Single pre-import check: format and size */
export function checkImportFile(file: {
  name: string;
  size: number;
}): ToolResult<'xlsx' | 'csv' | 'ods'> {
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

function toUniverBorder(
  side: { style?: string; color?: ExcelColorLike } | undefined,
  palette?: ThemePalette,
) {
  if (!side?.style) return undefined;
  const s = BORDER_TO_UNIVER[side.style] ?? 1;
  const rgb = excelColorToHex(side.color, palette);
  return { s, cl: rgb ? { rgb } : {} };
}

function toExcelBorder(side: { s: number; cl: { rgb?: string } } | undefined) {
  if (!side) return undefined;
  return {
    style: BORDER_TO_EXCEL[side.s] ?? 'thin',
    color: { argb: hexToArgb(side.cl?.rgb) ?? 'FF000000' },
  };
}

/**
 * ExcelJS style → Univer style: font (name / size / bold / italic / underline variants / strike /
 * colour / super-subscript) / background / alignment (including rotation and shrink-to-fit) / wrap /
 * number format / borders.
 *
 * `palette` is the workbook theme, needed to turn `theme="4"` colour references into RGB.
 */
export function excelStyleToUniver(style: ExcelStyleLite, palette?: ThemePalette): UniverStyleLite {
  const out: UniverStyleLite = {};
  const font = style.font;
  if (font?.name) out.ff = font.name;
  if (typeof font?.size === 'number') out.fs = font.size;
  if (font?.bold) out.bl = 1;
  if (font?.italic) out.it = 1;
  const underline = underlineToUniver(font?.underline);
  if (underline) out.ul = underline;
  if (font?.strike) out.st = { s: 1 };
  const fontColor = excelColorToHex(font?.color, palette);
  if (fontColor) out.cl = { rgb: fontColor };
  const baseline = vertAlignToUniver(font?.vertAlign);
  if (baseline) out.va = baseline;

  const fill = style.fill;
  if (fill?.type === 'pattern' || fill?.type === 'gradient') {
    const bg = excelColorToHex(fill.fgColor, palette);
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
  const rotation = textRotationToUniver(align?.textRotation);
  if (rotation) out.tr = rotation;
  // Excel turns wrapping off when shrinking (the glyphs get smaller instead of the line wrapping), so
  // shrink wins when a file carries both flags: clipping is closer to Excel than an unbounded wrap
  if (align?.shrinkToFit) out.tb = 2;
  else if (align?.wrapText) out.tb = 3;

  if (style.numFmt && style.numFmt !== 'General') out.n = { pattern: style.numFmt };

  const border = style.border;
  const bd = {
    t: toUniverBorder(border?.top, palette),
    r: toUniverBorder(border?.right, palette),
    b: toUniverBorder(border?.bottom, palette),
    l: toUniverBorder(border?.left, palette),
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
  const underline = univerUnderlineToExcel(style.ul);
  if (underline) font.underline = underline;
  if (style.st?.s) font.strike = true;
  const fontColor = hexToArgb(style.cl?.rgb);
  if (fontColor) font.color = { argb: fontColor };
  const baseline = univerVertAlignToExcel(style.va);
  if (baseline) font.vertAlign = baseline;
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
  const rotation = univerTextRotationToExcel(style.tr);
  if (rotation !== undefined) alignment.textRotation = rotation;
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
export function richTextFontToStyle(
  font: RichTextPiece['font'] | undefined,
  palette?: ThemePalette,
): UniverStyleLite {
  const out: UniverStyleLite = {};
  if (!font) return out;
  if (font.name) out.ff = font.name;
  if (typeof font.size === 'number') out.fs = font.size;
  if (font.bold) out.bl = 1;
  if (font.italic) out.it = 1;
  const underline = underlineToUniver(font.underline);
  if (underline) out.ul = underline;
  if (font.strike) out.st = { s: 1 };
  const color = excelColorToHex(font.color, palette);
  if (color) out.cl = { rgb: color };
  const baseline = vertAlignToUniver(font.vertAlign);
  if (baseline) out.va = baseline;
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
  const underline = univerUnderlineToExcel(style.ul);
  if (underline) font.underline = underline;
  if (style.st?.s) font.strike = true;
  const color = hexToArgb(style.cl?.rgb);
  if (color) font.color = { argb: color };
  const baseline = univerVertAlignToExcel(style.va);
  if (baseline) font.vertAlign = baseline;
  return Object.keys(font).length > 0 ? font : undefined;
}

/**
 * ExcelJS richText pieces → Univer cell rich text (ICellData.p).
 * Returns null when no style is worth keeping, in which case callers should just use plain text.
 */
export function richTextToCellDocument(
  pieces: readonly RichTextPiece[],
  id: string,
  palette?: ThemePalette,
): CellDocumentData | null {
  const text = pieces.map((piece) => piece.text ?? '').join('');
  if (!text) return null;
  const textRuns: CellDocumentData['body']['textRuns'] = [];
  let cursor = 0;
  for (const piece of pieces) {
    const length = (piece.text ?? '').length;
    const ts = richTextFontToStyle(piece.font, palette);
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
  /** 工具自有对象（演示模式要摊在网格上；见 `PresentObjectSource`） */
  syntoolsImages?: PresentImageSource[];
  syntoolsShapes?: PresentShapeSource[];
  syntoolsCharts?: PresentChartSource[];
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

/**
 * 演示网格的几何：**投影与渲染必须用同一组常量**（P2-10）。
 * 以前列宽写在组件里（108），如果投影另算一套，对象层就会与单元格错位——这正是"位置对不上"
 * 类 bug 的典型来源。行头 / 列头也在这里，因为对象坐标是相对整张表的左上角。
 */
export const PRESENT_CELL_WIDTH = 108;
export const PRESENT_ROW_HEIGHT = 26;
export const PRESENT_ROW_HEADER_WIDTH = 40;
export const PRESENT_COL_HEADER_HEIGHT = 26;

/**
 * 演示模式下要摊在网格上的对象（P2-10）。
 * 只声明"能定位 + 能画"的字段，不引 `shapes.ts` / `sheetImages.ts` / `charts.ts` 的类型——那几个
 * 模块都依赖 core，反向 import 会成环。形状 / 图片 / 图形的配置结构天然满足这些字段。
 */
export interface PresentObjectSource {
  id: string;
  sheetId?: string;
  z?: number;
  /** 单元格锚点（形状 / 图片用） */
  from?: { col: number; row: number; colOff: number; rowOff: number };
  /** 绝对像素位置（图表用：相对表格区域左上角） */
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface PresentImageSource extends PresentObjectSource {
  src: string;
  name?: string;
}

export interface PresentShapeSource extends PresentObjectSource {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  rotation?: number;
  text?: string;
}

export interface PresentChartSource extends PresentObjectSource {
  /** ChartType 的字面量（bar / line / pie …），演示时作为占位框的说明 */
  type?: string;
  title?: string;
}

/** 演示对象层的一项：坐标已经换算成"相对整张表的 CSS px" */
export interface PresentObject {
  id: string;
  kind: 'image' | 'shape' | 'chart';
  left: number;
  top: number;
  width: number;
  height: number;
  z: number;
  /** image：dataURL */
  src?: string;
  /** shape：填充 / 描边 / 文字 / 旋转 */
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  rotation?: number;
  text?: string;
  /** chart：标题（没有标题时退回类型名） */
  label?: string;
  /** 无障碍与调试用：图片名 / 形状名 */
  name?: string;
}

export interface PresentCell {
  row: number;
  col: number;
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** true = single line, 'double' = Excel's 双下划线 */
  underline?: boolean | 'double';
  /** BaselineOffset: superscript / subscript text */
  baseline?: 'super' | 'sub';
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
  /** 叠在网格上的图片 / 形状 / 图表占位框（P2-10），已按 z 从下往上排好 */
  objects: PresentObject[];
}

function alignOf(style: UniverStyleLite | undefined): PresentCell['align'] {
  if (style?.ht === 2) return 'center';
  if (style?.ht === 3) return 'right';
  if (style?.ht === 1) return 'left';
  return undefined;
}

/**
 * 单元格的显示文本：有值用值，只有公式时显示公式（快照里的公式已带 `=`）。
 * 演示视图与无障碍网格共用这一份规则，避免同一格在两种视图里读出不同的字。
 */
export function cellDisplayText(cell: { v?: unknown; f?: unknown } | undefined): string {
  if (!cell) return '';
  const value = cell.v ?? cell.f;
  if (value === undefined || value === null || value === '') return '';
  const formula = typeof cell.f === 'string' ? cell.f : '';
  if (formula && (cell.v === undefined || cell.v === null)) {
    return formula.startsWith('=') ? formula : `=${formula}`;
  }
  return String(value);
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
      const text = cellDisplayText(cell);
      if (!text) continue;
      const style = (cell as { s?: UniverStyleLite }).s;
      cells.push({
        row,
        col,
        text,
        ...(style?.bl === 1 ? { bold: true } : {}),
        ...(style?.it === 1 ? { italic: true } : {}),
        ...(style?.ul?.s === 1
          ? { underline: style.ul.t === TEXT_DECORATION_DOUBLE ? ('double' as const) : true }
          : {}),
        ...(style?.va === BASELINE_SUPERSCRIPT
          ? { baseline: 'super' as const }
          : style?.va === BASELINE_SUBSCRIPT
            ? { baseline: 'sub' as const }
            : {}),
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
    objects: buildPresentObjects(snapshot, target, order[0] ?? target),
  };
}

/**
 * 把对象摊到演示网格上（P2-10）：复用 P1-6 的投影思路——**锚点 → 单元格 → 像素**，
 * 只是这里的像素是演示表格自己的列宽 / 行高，不是编辑器的真实列宽。
 *
 * 三件必须说清的事：
 * 1. 图的 `x/y` 是相对表格区域左上角的像素，所以要加上行头 / 列头；
 * 2. 没有 `sheetId` 的对象挂第一张表（与编辑模式里"图表归属"的兜底规则一致）；
 * 3. 先按 z 升序，同 z 保持原顺序（`sort` 在 V8 上是稳定的）——叠放顺序与编辑模式一致。
 */
function buildPresentObjects(
  snapshot: WorkbookSnapshotLite,
  sheetId: string,
  firstSheetId: string,
): PresentObject[] {
  const ownerOf = (source: PresentObjectSource): string =>
    source.sheetId && snapshot.sheets?.[source.sheetId] ? source.sheetId : firstSheetId;
  const anchorLeft = (source: PresentObjectSource): number =>
    PRESENT_ROW_HEADER_WIDTH +
    (source.from ? source.from.col * PRESENT_CELL_WIDTH + source.from.colOff : 0);
  const anchorTop = (source: PresentObjectSource): number =>
    PRESENT_COL_HEADER_HEIGHT +
    (source.from ? source.from.row * PRESENT_ROW_HEIGHT + source.from.rowOff : 0);

  const objects: PresentObject[] = [];

  for (const image of snapshot.syntoolsImages ?? []) {
    if (ownerOf(image) !== sheetId) continue;
    objects.push({
      id: image.id,
      kind: 'image',
      left: anchorLeft(image),
      top: anchorTop(image),
      width: image.width,
      height: image.height,
      z: image.z ?? 0,
      src: image.src,
      ...(image.name ? { name: image.name } : {}),
    });
  }

  for (const shape of snapshot.syntoolsShapes ?? []) {
    if (ownerOf(shape) !== sheetId) continue;
    objects.push({
      id: shape.id,
      kind: 'shape',
      left: anchorLeft(shape),
      top: anchorTop(shape),
      width: shape.width,
      height: shape.height,
      z: shape.z ?? 0,
      ...(shape.fill ? { fill: shape.fill } : {}),
      ...(shape.stroke ? { stroke: shape.stroke } : {}),
      ...(shape.strokeWidth === undefined ? {} : { strokeWidth: shape.strokeWidth }),
      ...(shape.rotation === undefined ? {} : { rotation: shape.rotation }),
      ...(shape.text ? { text: shape.text } : {}),
    });
  }

  for (const chart of snapshot.syntoolsCharts ?? []) {
    if (ownerOf(chart) !== sheetId) continue;
    objects.push({
      id: chart.id,
      kind: 'chart',
      left: PRESENT_ROW_HEADER_WIDTH + (chart.x ?? 0),
      top: PRESENT_COL_HEADER_HEIGHT + (chart.y ?? 0),
      width: chart.width,
      height: chart.height,
      z: chart.z ?? 0,
      label: chart.title || chart.type || '',
    });
  }

  return objects.sort((a, b) => a.z - b.z);
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
