import { columnIndexToName } from './core';

/**
 * Pure mapping between Univer's cell styles and the neutral state the ribbon renders.
 *
 * Deliberately free of `@univerjs/*` imports: the structural `UniverStyleLike` below mirrors the keys
 * we read (`IStyleData` in Univer 0.25.1), so this module runs in vitest/jsdom and survives a Univer
 * upgrade by failing a unit test instead of silently breaking the ribbon.
 */

/** A toggle whose cells disagree — rendered without the "pressed" state, like Office does */
export type TriState = boolean | 'mixed';

export type HAlign = 'general' | 'left' | 'center' | 'right' | 'mixed';
export type VAlign = 'top' | 'middle' | 'bottom' | 'mixed';

/** Line weights offered by the border tools; the Univer enum lives in `univer.ts` */
export type BorderStyleId = 'thin' | 'medium' | 'thick' | 'dashed' | 'dotted' | 'double';

/** A border the user picked (line style + colour) — applied to the next border-preset click */
export interface BorderSpec {
  style: BorderStyleId;
  color: string;
}

export const DEFAULT_BORDER: BorderSpec = { style: 'thin', color: '#000000' };

export interface SheetFormatState {
  bold: TriState;
  italic: TriState;
  underline: TriState;
  strike: TriState;
  fontFamily: string | null;
  fontSize: number | null;
  color: string | null;
  fill: string | null;
  hAlign: HAlign;
  vAlign: VAlign;
  wrap: TriState;
  numberFormat: string | null;
  /**
   * Presence + colour of the cell border, or `null` when the sampled cells have none.
   *
   * The exact line weight is deliberately not decoded: Univer stores it as a numeric
   * `BorderStyleTypes`, and mapping that table without verifying 0.25.1 would put a guess into the
   * painter. Painting therefore reproduces "has a border, in this colour", which is what users
   * check; the precise weight stays whatever the target already had.
   */
  border: BorderSpec | null;
  merged: boolean;
}

/** Partial style write: only the keys present are applied, so one click never wipes other formatting */
export interface SheetFormatPatch {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontFamily?: string | null;
  fontSize?: number | null;
  color?: string | null;
  fill?: string | null;
  hAlign?: 'general' | 'left' | 'center' | 'right';
  vAlign?: 'top' | 'middle' | 'bottom';
  wrap?: boolean;
  numberFormat?: string | null;
  /** `undefined` leaves borders alone, `null` clears them, a spec draws an all-around border */
  border?: BorderSpec | null;
}

export const EMPTY_SHEET_FORMAT: SheetFormatState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  fontFamily: null,
  fontSize: null,
  color: null,
  fill: null,
  hAlign: 'general',
  vAlign: 'bottom',
  wrap: false,
  numberFormat: null,
  border: null,
  merged: false,
};

/** Text decoration key shared by underline / strike */
interface DecorationLike {
  s?: 0 | 1 | boolean;
}

/** Horizontal / vertical alignment / wrap enums of `@univerjs/core` (0 = unspecified) */
const H_ALIGN: Record<number, HAlign> = { 1: 'left', 2: 'center', 3: 'right' };
const V_ALIGN: Record<number, VAlign> = { 1: 'top', 2: 'middle', 3: 'bottom' };
const WRAP = 3;

/** One side of an `IBorderData` entry */
interface BorderSideLike {
  s?: number;
  cl?: { rgb?: string | null } | null;
}

/** Structural mirror of Univer's `IBorderData` */
interface BorderDataLike {
  t?: BorderSideLike | null;
  b?: BorderSideLike | null;
  l?: BorderSideLike | null;
  r?: BorderSideLike | null;
}

/** Structural mirror of the subset of Univer's `IStyleData` this tool reads */
export interface UniverStyleLike {
  ff?: string | null;
  fs?: number;
  it?: 0 | 1;
  bl?: 0 | 1;
  ul?: DecorationLike | null;
  st?: DecorationLike | null;
  cl?: { rgb?: string | null } | null;
  bg?: { rgb?: string | null } | null;
  ht?: number | null;
  vt?: number | null;
  tb?: number | null;
  n?: { pattern?: string } | null;
  bd?: BorderDataLike | null;
}

const decorationOn = (decoration?: DecorationLike | null): boolean => Boolean(decoration?.s);

const toggle = (values: boolean[]): TriState => {
  if (values.length === 0) return false;
  const first = values[0];
  return values.every((value) => value === first) ? first : 'mixed';
};

const sameString = (values: (string | null)[]): string | null => {
  if (values.length === 0) return null;
  const first = values[0] ?? null;
  return values.every((value) => (value ?? null) === first) ? first : null;
};

const sameNumber = (values: (number | null)[]): number | null => {
  if (values.length === 0) return null;
  const first = values[0] ?? null;
  return values.every((value) => (value ?? null) === first) ? first : null;
};

/** First drawn side of a cell, or `null` when the cell has no border at all */
function readBorder(style: UniverStyleLike): BorderSpec | null {
  const side = [style.bd?.t, style.bd?.b, style.bd?.l, style.bd?.r].find(
    (entry) => entry && (entry.s ?? 0) > 0,
  );
  if (!side) return null;
  return { style: 'thin', color: side.cl?.rgb ?? DEFAULT_BORDER.color };
}

/** Same border across the sampled cells; a mix (or none) collapses to `null` */
function sameBorder(styles: UniverStyleLike[]): BorderSpec | null {
  if (styles.length === 0) return null;
  const first = readBorder(styles[0] ?? {});
  if (!first) return null;
  const signature = `${first.style}:${first.color}`;
  const agree = styles.every((style) => {
    const spec = readBorder(style);
    return spec !== null && `${spec.style}:${spec.color}` === signature;
  });
  return agree ? first : null;
}

/**
 * Fold the styles of the sampled cells into one ribbon state.
 * Empty input (no selection, or the render unit is not ready) yields the neutral state.
 */
export function readSheetFormat(styles: UniverStyleLike[], merged = false): SheetFormatState {
  if (styles.length === 0) return { ...EMPTY_SHEET_FORMAT, merged };

  const alignments = styles.map((style) => H_ALIGN[style.ht ?? 0] ?? 'general');
  const verticals = styles.map((style) => V_ALIGN[style.vt ?? 0] ?? 'bottom');
  const hAlign = alignments.every((value) => value === alignments[0])
    ? (alignments[0] ?? 'general')
    : ('mixed' as const);
  const vAlign = verticals.every((value) => value === verticals[0])
    ? (verticals[0] ?? 'bottom')
    : ('mixed' as const);

  return {
    bold: toggle(styles.map((style) => style.bl === 1)),
    italic: toggle(styles.map((style) => style.it === 1)),
    underline: toggle(styles.map((style) => decorationOn(style.ul))),
    strike: toggle(styles.map((style) => decorationOn(style.st))),
    fontFamily: sameString(styles.map((style) => style.ff ?? null)),
    fontSize: sameNumber(styles.map((style) => style.fs ?? null)),
    color: sameString(styles.map((style) => style.cl?.rgb ?? null)),
    fill: sameString(styles.map((style) => style.bg?.rgb ?? null)),
    hAlign,
    vAlign,
    wrap: toggle(styles.map((style) => (style.tb ?? 0) === WRAP)),
    numberFormat: sameString(styles.map((style) => style.n?.pattern ?? null)),
    border: sameBorder(styles),
    merged,
  };
}

/* ------------------------------ number formats ------------------------------ */

export interface NumberFormatPreset {
  id: string;
  labelKey: string;
  /** Univer/xlsx pattern; empty string means "General" */
  pattern: string;
  /** What a typical value looks like once the pattern is applied — shown in the ribbon dropdown */
  sample: string;
}

/** Excel's number-format dropdown, minus the locale-specific accounting variants */
export const NUMBER_FORMAT_PRESETS: NumberFormatPreset[] = [
  { id: 'general', labelKey: 'numberGeneral', pattern: '', sample: '1234.5' },
  { id: 'number', labelKey: 'numberNumber', pattern: '#,##0.00', sample: '1,234.50' },
  { id: 'currency', labelKey: 'numberCurrency', pattern: '¥#,##0.00', sample: '¥1,234.50' },
  { id: 'percent', labelKey: 'numberPercent', pattern: '0.00%', sample: '1234.50%' },
  { id: 'thousand', labelKey: 'numberThousand', pattern: '#,##0', sample: '1,235' },
  { id: 'date', labelKey: 'numberDate', pattern: 'yyyy-mm-dd', sample: '2026-11-03' },
  { id: 'time', labelKey: 'numberTime', pattern: 'hh:mm:ss', sample: '14:30:00' },
  { id: 'text', labelKey: 'numberText', pattern: '@', sample: '文本' },
  { id: 'scientific', labelKey: 'numberScientific', pattern: '0.00E+00', sample: '1.23E+03' },
];

/** Pattern used by the "add decimal place" command when the cell has no explicit format yet */
export const DEFAULT_DECIMAL_PATTERN = '0.00';

/**
 * Add or remove one decimal place, keeping the rest of the pattern intact (Excel's ≔.0 / ≔.00).
 *
 * The first numeric placeholder (`0` / `#` run, optionally followed by `.` decimals) is adjusted; a
 * pattern without one (e.g. text `@`) is returned unchanged so the button is a no-op rather than
 * destroying the format.
 */
export function shiftDecimals(pattern: string, delta: number): string {
  const trimmed = pattern || DEFAULT_DECIMAL_PATTERN;
  // The integer part may carry thousands separators ('#,##0.00'), so commas belong to the run
  const match = /[0#,]+(?:\.[0#]+)?/.exec(trimmed);
  if (!match) return trimmed;
  const [number] = match;
  const [integer, decimals = ''] = number.split('.');
  const nextCount = Math.max(0, decimals.length + delta);
  const nextDecimals = nextCount === 0 ? '' : `.${'0'.repeat(nextCount)}`;
  const next = `${integer ?? '0'}${nextDecimals}`;
  return trimmed.slice(0, match.index) + next + trimmed.slice(match.index + number.length);
}

/** Toggle the thousands separator of the first numeric placeholder */
export function toggleThousandSeparator(pattern: string): string {
  const trimmed = pattern || DEFAULT_DECIMAL_PATTERN;
  const match = /[0#][0#,]*/.exec(trimmed);
  if (!match) return trimmed;
  const [integer] = match;
  // Removing the separator also collapses the '#,##0' placeholder run back to '#0'
  const next = integer.includes(',') ? integer.replaceAll(',', '').replace(/#{2,}/g, '#') : '#,##0';
  return trimmed.slice(0, match.index) + next + trimmed.slice(match.index + integer.length);
}

/* --------------------------------- borders --------------------------------- */

export type BorderPresetId =
  'none' | 'all' | 'outside' | 'inside' | 'bottom' | 'top' | 'left' | 'right' | 'thickOutside';

export interface BorderPreset {
  id: BorderPresetId;
  labelKey: string;
  icon: string;
}

/** Menu of the "边框" split button */
export const BORDER_PRESETS: BorderPreset[] = [
  { id: 'bottom', labelKey: 'borderBottom', icon: 'borderBottom' },
  { id: 'top', labelKey: 'borderTop', icon: 'borderTop' },
  { id: 'left', labelKey: 'borderLeft', icon: 'borderLeft' },
  { id: 'right', labelKey: 'borderRight', icon: 'borderRight' },
  { id: 'none', labelKey: 'borderNone', icon: 'borderNone' },
  { id: 'all', labelKey: 'borderAll', icon: 'borders' },
  { id: 'outside', labelKey: 'borderOutside', icon: 'borderOutside' },
  { id: 'inside', labelKey: 'borderInside', icon: 'borders' },
  { id: 'thickOutside', labelKey: 'borderThickOutside', icon: 'borderOutside' },
];

/**
 * Line weights of the border menu. Excel lets the user pick a weight *before* drawing the border;
 * the ribbon keeps that pending choice in component state and passes it with every preset click.
 */
export const BORDER_STYLES: Array<{ id: BorderStyleId; labelKey: string }> = [
  { id: 'thin', labelKey: 'borderThin' },
  { id: 'medium', labelKey: 'borderMedium' },
  { id: 'thick', labelKey: 'borderThick' },
  { id: 'dashed', labelKey: 'borderDashed' },
  { id: 'dotted', labelKey: 'borderDotted' },
  { id: 'double', labelKey: 'borderDouble' },
];

/* -------------------------------- auto sum -------------------------------- */

export interface CellRangeModel {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

/** `A1:B4` style label for a zero-based inclusive range */
export function rangeLabel(range: CellRangeModel): string {
  const from = `${columnIndexToName(range.startColumn)}${range.startRow + 1}`;
  const to = `${columnIndexToName(range.endColumn)}${range.endRow + 1}`;
  return from === to ? from : `${from}:${to}`;
}

/**
 * Where "AutoSum" lands and what it inserts: Excel sums the column above the selection when it is
 * vertical, otherwise the row to the left — the formula goes into the cell right after the block.
 */
export function buildAutoSum(range: CellRangeModel): {
  row: number;
  column: number;
  formula: string;
} {
  const vertical = range.endRow > range.startRow;
  const formula = `=SUM(${rangeLabel(range)})`;
  return vertical
    ? { row: range.endRow + 1, column: range.startColumn, formula }
    : { row: range.startRow, column: range.endColumn + 1, formula };
}

/** Font-size presets of the ribbon (pt, matching Univer's `fs`) */
export const FONT_SIZE_PRESETS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];

/**
 * Parse clipboard text into a matrix for "paste".
 *
 * Spreadsheet content arrives as TSV (Excel / Numbers / our own copy), so tabs split columns and
 * newlines split rows; a trailing newline must not produce an empty extra row.
 */
export function parseClipboardMatrix(text: string): string[][] {
  const normalized = text.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.map((line) => line.split('\t'));
}

/** Font families offered by the ribbon (installed fonts are detected by the word processor only) */
export const FONT_FAMILY_PRESETS = [
  'Arial',
  'Calibri',
  'Cambria',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Microsoft YaHei',
  'SimSun',
  'PingFang SC',
  'Source Han Sans SC',
];
