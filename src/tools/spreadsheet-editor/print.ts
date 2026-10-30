import type { ToolResult } from '@/core/types';
import { excelSerialToDate, type UniverStyleLite } from './core';
import type { SheetSnapshot, WorkbookSnapshot } from './xlsx-io';

/**
 * Spreadsheet printing: snapshot → print model → paginated pages → HTML.
 *
 * Layout is a pure function chain (no DOM), so column/row pagination, repeat-header rows,
 * fit-to-width scaling and merged-cell clipping are all unit-testable. Rendering only turns the
 * page model into absolutely-sized tables, which is what the browser print engine consumes.
 *
 * Units: geometry is in PDF points (1pt = 1/72in); snapshot px values are converted with 0.75.
 */

export type PaperSize = 'A4' | 'A3' | 'Letter';
export type Orientation = 'portrait' | 'landscape';
/** What to print: the current selection / the used range / the whole sheet (capped at the used range) */
export type PrintAreaMode = 'selection' | 'used' | 'sheet';

export interface CellRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

export interface SheetPrintOptions {
  paper: PaperSize;
  orientation: Orientation;
  /** Uniform page margin, in points */
  margin: number;
  /** 'fit' scales the used range down to the page width; 'actual' prints at 100% */
  scale: 'fit' | 'actual';
  /** Repeat the first printed row at the top of every following page */
  repeatHeaderRow: boolean;
  gridlines: boolean;
}

export const PAPER_SIZES: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  A3: { width: 841.89, height: 1190.55 },
  Letter: { width: 612, height: 792 },
};

export const DEFAULT_SHEET_PRINT_OPTIONS: SheetPrintOptions = {
  paper: 'A4',
  orientation: 'portrait',
  margin: 36,
  scale: 'fit',
  repeatHeaderRow: true,
  gridlines: true,
};

/** Snapshot px → pt */
const PX_TO_PT = 0.75;

/**
 * fit 模式最多缩到 50%。再小的字（9pt × 0.35 ≈ 3pt）打印出来只是灰条，
 * 不如按列拆页——这也是 Excel 的行为：缩到装不下就分页，而不是无限缩。
 */
const MIN_FIT_SCALE = 0.5;

export function resolvePageSize(options: SheetPrintOptions): { width: number; height: number } {
  const base = PAPER_SIZES[options.paper];
  return options.orientation === 'landscape'
    ? { width: base.height, height: base.width }
    : { width: base.width, height: base.height };
}

/** 实际打印缩放：fit 只在"缩得动"时生效，超出下限就交给分页 */
export function resolvePrintScale(model: SheetPrintModel, options: SheetPrintOptions): number {
  if (options.scale !== 'fit') return 1;
  const contentWidth = resolvePageSize(options).width - options.margin * 2;
  if (contentWidth <= 0 || model.width <= contentWidth) return 1;
  return Math.max(contentWidth / model.width, MIN_FIT_SCALE);
}

/** Smallest range that contains data; null for an empty sheet */
export function resolveUsedRange(sheet: SheetSnapshot): CellRange | null {
  let maxRow = -1;
  let maxCol = -1;
  for (const [rowKey, rowCells] of Object.entries(sheet.cellData ?? {})) {
    const row = Number(rowKey);
    if (!Number.isFinite(row)) continue;
    for (const [colKey, cell] of Object.entries(rowCells ?? {})) {
      const col = Number(colKey);
      if (!Number.isFinite(col)) continue;
      const hasValue = cell?.v !== undefined && cell?.v !== null && cell?.v !== '';
      if (!hasValue && !cell?.f) continue;
      maxRow = Math.max(maxRow, row);
      maxCol = Math.max(maxCol, col);
    }
  }
  if (maxRow < 0 || maxCol < 0) return null;
  return { startRow: 0, startColumn: 0, endRow: maxRow, endColumn: maxCol };
}

/** Clamp a requested range to the sheet's used content */
export function clampRange(range: CellRange, used: CellRange | null): CellRange | null {
  if (!used) return null;
  const startRow = Math.max(Math.min(range.startRow, range.endRow), used.startRow);
  const endRow = Math.min(Math.max(range.startRow, range.endRow), used.endRow);
  const startColumn = Math.max(Math.min(range.startColumn, range.endColumn), used.startColumn);
  const endColumn = Math.min(Math.max(range.startColumn, range.endColumn), used.endColumn);
  if (endRow < startRow || endColumn < startColumn) return null;
  return { startRow, startColumn, endRow, endColumn };
}

/** Resolve the range to print for a given mode */
export function resolvePrintRange(
  sheet: SheetSnapshot,
  mode: PrintAreaMode,
  selection?: CellRange | null,
): CellRange | null {
  const used = resolveUsedRange(sheet);
  if (!used) return null;
  if (mode === 'selection' && selection) return clampRange(selection, used);
  // 'used' and 'sheet' both stop at the used range: printing 16k empty rows is never what users want
  return used;
}

/**
 * Number formatting for printing. Only the patterns that actually show up in spreadsheets are
 * handled (percent / fixed decimals / thousands separators / dates); anything else falls back to
 * the raw value so nothing is silently mangled.
 */
export function formatSheetValue(value: unknown, pattern?: string): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value !== 'number') return String(value);
  if (!pattern) return String(value);

  const decimals = (() => {
    const dot = pattern.indexOf('.');
    if (dot < 0) return 0;
    const match = /^[0#]*/.exec(pattern.slice(dot + 1));
    return match ? match[0].replace(/#/g, '').length : 0;
  })();

  if (pattern.includes('%')) return `${(value * 100).toFixed(decimals)}%`;
  if (/[ymd]/i.test(pattern) && /[-/]/.test(pattern)) {
    const date = excelSerialToDate(value);
    if (!Number.isNaN(date.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }
  }
  if (pattern.includes('#')) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  if (pattern.includes('0')) return value.toFixed(decimals);
  return String(value);
}

export interface SheetPrintCell {
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
  /** Explicit borders from the cell style (independent of the gridline option) */
  bordered?: boolean;
  /** Anchor of a merged range: spans in cells */
  rowSpan?: number;
  colSpan?: number;
  /** Inside a merged range but not its anchor: nothing to draw */
  covered?: boolean;
}

export interface SheetPrintModel {
  sheetName: string;
  range: CellRange;
  columns: { index: number; width: number }[];
  rows: { index: number; height: number }[];
  cells: SheetPrintCell[];
  /** Total size in points at 100% */
  width: number;
  height: number;
}

const DEFAULT_COLUMN_PX = 64;
const DEFAULT_ROW_PX = 20;
/** Font size cap: a 96pt cell would blow up the page */
const MAX_FONT_SIZE = 24;

function alignOf(style: UniverStyleLite | undefined): SheetPrintCell['align'] {
  if (style?.ht === 2) return 'center';
  if (style?.ht === 3) return 'right';
  if (style?.ht === 1) return 'left';
  return undefined;
}

/** Build the printable model (columns / rows / cells / merges) for a range */
export function buildSheetPrintModel(
  snapshot: WorkbookSnapshot,
  sheetId: string | null,
  range: CellRange | null,
): SheetPrintModel | null {
  const ids = snapshot.sheetOrder?.length
    ? snapshot.sheetOrder
    : Object.keys(snapshot.sheets ?? {});
  const target = sheetId && snapshot.sheets?.[sheetId] ? sheetId : ids[0];
  if (!target) return null;
  const sheet = snapshot.sheets?.[target];
  if (!sheet) return null;
  const area = range ?? resolveUsedRange(sheet);
  if (!area) return null;

  const columns: { index: number; width: number }[] = [];
  for (let col = area.startColumn; col <= area.endColumn; col += 1) {
    const px = sheet.columnData?.[String(col)]?.w ?? sheet.defaultColumnWidth ?? DEFAULT_COLUMN_PX;
    columns.push({ index: col, width: Math.max(px, 8) * PX_TO_PT });
  }
  const rows: { index: number; height: number }[] = [];
  for (let row = area.startRow; row <= area.endRow; row += 1) {
    const px = sheet.rowData?.[String(row)]?.h ?? sheet.defaultRowHeight ?? DEFAULT_ROW_PX;
    rows.push({ index: row, height: Math.max(px, 8) * PX_TO_PT });
  }

  const merges = (sheet.mergeData ?? []).filter(
    (merge) =>
      merge.startRow <= area.endRow &&
      merge.endRow >= area.startRow &&
      merge.startColumn <= area.endColumn &&
      merge.endColumn >= area.startColumn,
  );

  const cells: SheetPrintCell[] = [];
  const covered = new Set<string>();
  for (const merge of merges) {
    for (let row = merge.startRow; row <= merge.endRow; row += 1) {
      for (let col = merge.startColumn; col <= merge.endColumn; col += 1) {
        if (row === merge.startRow && col === merge.startColumn) continue;
        covered.add(`${row}:${col}`);
      }
    }
  }

  for (let row = area.startRow; row <= area.endRow; row += 1) {
    const rowCells = sheet.cellData?.[String(row)] ?? {};
    for (let col = area.startColumn; col <= area.endColumn; col += 1) {
      const key = `${row}:${col}`;
      if (covered.has(key)) continue;
      const cell = rowCells[String(col)];
      const style = cell?.s;
      const raw = cell?.v;
      const text =
        raw === undefined || raw === null || raw === ''
          ? ''
          : formatSheetValue(raw, style?.n?.pattern);
      const merge = merges.find((m) => m.startRow === row && m.startColumn === col);
      const rowSpan = merge ? Math.min(merge.endRow, area.endRow) - row + 1 : undefined;
      const colSpan = merge ? Math.min(merge.endColumn, area.endColumn) - col + 1 : undefined;
      if (!text && !merge && !style?.bg?.rgb && !style?.bd) continue;
      const border = style?.bd;
      cells.push({
        row,
        col,
        text,
        ...(style?.bl === 1 ? { bold: true } : {}),
        ...(style?.it === 1 ? { italic: true } : {}),
        ...(style?.ul?.s === 1 ? { underline: true } : {}),
        ...(style?.fs !== undefined
          ? { fontSize: Math.min(Math.round(style.fs), MAX_FONT_SIZE) }
          : {}),
        ...(style?.cl?.rgb ? { color: style.cl.rgb } : {}),
        ...(style?.bg?.rgb ? { background: style.bg.rgb } : {}),
        ...(alignOf(style) ? { align: alignOf(style) } : {}),
        ...(border && (border.t || border.r || border.b || border.l) ? { bordered: true } : {}),
        ...(rowSpan && rowSpan > 1 ? { rowSpan } : {}),
        ...(colSpan && colSpan > 1 ? { colSpan } : {}),
      });
    }
  }

  return {
    sheetName: sheet.name ?? '',
    range: area,
    columns,
    rows,
    cells: cells.sort((a, b) => a.row - b.row || a.col - b.col),
    width: columns.reduce((sum, column) => sum + column.width, 0),
    height: rows.reduce((sum, row) => sum + row.height, 0),
  };
}

export interface SheetPrintPage {
  index: number;
  pageCount: number;
  /** Column indices on this page, left → right */
  columns: number[];
  /** Row indices on this page, top → bottom (header row repeated at the top when enabled) */
  rows: number[];
  /** The first entry of `rows` is the repeated header of an earlier page */
  repeatedHeader: boolean;
}

/**
 * Paginate a print model onto sheets.
 * Column bands are the outer loop (Excel prints all row pages of the first column band first).
 */
export function paginateSheet(
  model: SheetPrintModel,
  options: SheetPrintOptions,
): SheetPrintPage[] {
  const size = resolvePageSize(options);
  const contentWidth = size.width - options.margin * 2;
  const contentHeight = size.height - options.margin * 2;
  if (contentWidth <= 0 || contentHeight <= 0) return [];

  // 统一走分列循环：缩得下时自然只有一列带，缩不下（含 fit 触到下限）就横向分页
  const scale = resolvePrintScale(model, options);
  const columnBands: number[][] = [];
  let colBand: number[] = [];
  let colUsed = 0;
  for (const column of model.columns) {
    const width = column.width * scale;
    // 1e-6：fit 刚好整除时不要被浮点误差拆成两页
    if (colBand.length > 0 && colUsed + width > contentWidth + 1e-6) {
      columnBands.push(colBand);
      colBand = [];
      colUsed = 0;
    }
    colBand.push(column.index);
    colUsed += width;
  }
  if (colBand.length > 0) columnBands.push(colBand);

  const headerRow = options.repeatHeaderRow ? model.rows[0]?.index : undefined;
  const headerHeight = headerRow === undefined ? 0 : (model.rows[0]?.height ?? 0) * scale;

  const rowBands: { rows: number[]; repeatedHeader: boolean }[] = [];
  let band: number[] = [];
  let used = 0;
  for (const row of model.rows) {
    const height = row.height * scale;
    if (band.length > 0 && used + height > contentHeight) {
      rowBands.push({ rows: band, repeatedHeader: false });
      band = [];
      used = 0;
    }
    band.push(row.index);
    used += height;
  }
  if (band.length > 0) rowBands.push({ rows: band, repeatedHeader: false });

  // Repeat the header on every row band after the first
  for (let index = 1; index < rowBands.length; index += 1) {
    if (headerRow !== undefined && !rowBands[index].rows.includes(headerRow)) {
      rowBands[index] = {
        rows: [headerRow, ...rowBands[index].rows],
        repeatedHeader: true,
      };
    }
    // The repeated header eats into the available height; drop trailing rows that no longer fit
    if (headerHeight > 0) {
      let total = headerHeight;
      const kept: number[] = [headerRow as number];
      for (const rowId of rowBands[index].rows.slice(1)) {
        const height = (model.rows.find((row) => row.index === rowId)?.height ?? 0) * scale;
        if (total + height > contentHeight) break;
        total += height;
        kept.push(rowId);
      }
      rowBands[index] = { rows: kept, repeatedHeader: true };
    }
  }

  const pages: SheetPrintPage[] = [];
  for (const columns of columnBands) {
    for (const rowBand of rowBands) {
      if (rowBand.rows.length === 0) continue;
      pages.push({
        index: pages.length + 1,
        pageCount: 0,
        columns,
        rows: rowBand.rows,
        repeatedHeader: rowBand.repeatedHeader,
      });
    }
  }
  for (const page of pages) page.pageCount = pages.length;
  return pages;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** One `<td>` per cell; merged anchors are clipped to the current page */
function renderCell(
  cell: SheetPrintCell,
  page: SheetPrintPage,
  model: SheetPrintModel,
  scale: number,
): string {
  const rowPos = page.rows.indexOf(cell.row);
  const colPos = page.columns.indexOf(cell.col);
  if (rowPos < 0 || colPos < 0) return '';

  let colSpan = 1;
  if (cell.colSpan && cell.colSpan > 1) {
    for (let step = 1; step < cell.colSpan; step += 1) {
      const next = page.columns[colPos + step];
      const expected = cell.col + step;
      if (next !== expected) break;
      colSpan += 1;
    }
  }
  let rowSpan = 1;
  if (cell.rowSpan && cell.rowSpan > 1) {
    for (let step = 1; step < cell.rowSpan; step += 1) {
      const next = page.rows[rowPos + step];
      const expected = cell.row + step;
      if (next !== expected) break;
      rowSpan += 1;
    }
  }

  const styles: string[] = [];
  if (cell.bold) styles.push('font-weight:600');
  if (cell.italic) styles.push('font-style:italic');
  if (cell.underline) styles.push('text-decoration:underline');
  if (cell.fontSize) styles.push(`font-size:${(cell.fontSize * PX_TO_PT).toFixed(2)}pt`);
  if (cell.color) styles.push(`color:${cell.color}`);
  if (cell.background) styles.push(`background:${cell.background}`);
  if (cell.align) styles.push(`text-align:${cell.align}`);
  if (cell.bordered) styles.push('border:0.75pt solid #9ca3af');
  if (rowSpan > 1)
    styles.push(
      `height:${(
        model.rows
          .filter((row) => row.index >= cell.row && row.index < cell.row + rowSpan)
          .reduce((sum, row) => sum + row.height, 0) * scale
      ).toFixed(2)}pt`,
    );

  return `<td${colSpan > 1 ? ` colspan="${colSpan}"` : ''}${
    rowSpan > 1 ? ` rowspan="${rowSpan}"` : ''
  } style="${styles.join(';')}">${escapeHtml(cell.text)}</td>`;
}

/** Printable HTML: one section per page, each holding a fixed-size table */
export function buildSheetPrintHtml(
  model: SheetPrintModel,
  pages: SheetPrintPage[],
  options: SheetPrintOptions,
  title = 'sheet',
): string {
  const size = resolvePageSize(options);
  const contentWidth = size.width - options.margin * 2;
  const scale = resolvePrintScale(model, options);
  const gridline = options.gridlines ? 'border:0.4pt solid #d4d4d8;' : '';

  const body = pages
    .map((page) => {
      const cols = page.columns
        .map((index) => model.columns.find((column) => column.index === index))
        .filter((column): column is { index: number; width: number } => Boolean(column));
      const colgroup = cols
        .map((column) => `<col style="width:${(column.width * scale).toFixed(2)}pt">`)
        .join('');
      // 分列打印时每页只放这一带的列：表格宽度必须按带算，否则第二页会把列挤成 1pt
      const tableWidth = Math.min(
        cols.reduce((sum, column) => sum + column.width, 0) * scale,
        contentWidth,
      );
      const rowsHtml = page.rows
        .map((rowIndex) => {
          const row = model.rows.find((item) => item.index === rowIndex);
          const height = (row?.height ?? 0) * scale;
          const tds = page.columns
            .map((colIndex) => {
              const cell = model.cells.find(
                (item) => item.row === rowIndex && item.col === colIndex,
              );
              return cell ? renderCell(cell, page, model, scale) : '<td></td>';
            })
            .join('');
          return `<tr style="height:${height.toFixed(2)}pt">${tds}</tr>`;
        })
        .join('');
      return `<section class="print-page"><table class="sheet-table" style="width:${tableWidth.toFixed(
        2,
      )}pt;${gridline}">${colgroup}${rowsHtml}</table></section>`;
    })
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
@page { size: ${size.width}pt ${size.height}pt; margin: 0 }
html, body { margin: 0; padding: 0; background: #fff }
.print-page { position: relative; width: ${size.width}pt; height: ${size.height}pt;
  padding: ${options.margin}pt; box-sizing: border-box; overflow: hidden;
  page-break-after: always; break-after: page }
.print-page:last-child { page-break-after: auto; break-after: auto }
.sheet-table { border-collapse: collapse; table-layout: fixed; font: 9pt/1.35 system-ui, -apple-system, sans-serif }
.sheet-table td { ${gridline} padding: 2pt 3pt; vertical-align: middle;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
@media print { .sheet-table td { overflow: hidden } }
</style></head><body>${body}</body></html>`;
}

/**
 * Browser printing: open the window synchronously (keeps the user gesture), then fill it and print.
 * Returns PRINT_BLOCKED when the popup was denied so the caller can fall back to PDF export.
 */
export async function printSheet(
  snapshot: WorkbookSnapshot,
  sheetId: string | null,
  options: SheetPrintOptions,
  range: CellRange | null = null,
): Promise<ToolResult<{ pages: number }>> {
  if (typeof window === 'undefined') return { ok: false, error: 'PRINT_UNSUPPORTED' };
  const model = buildSheetPrintModel(snapshot, sheetId, range);
  if (!model) return { ok: false, error: 'EMPTY' };
  const pages = paginateSheet(model, options);
  if (pages.length === 0) return { ok: false, error: 'EMPTY' };

  const win = window.open('', '_blank');
  if (!win) return { ok: false, error: 'PRINT_BLOCKED' };

  win.document.open();
  win.document.write(
    buildSheetPrintHtml(model, pages, options, snapshot.name || model.sheetName || 'sheet'),
  );
  win.document.close();
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 50);
  });
  win.focus();
  win.print();
  return { ok: true, value: { pages: pages.length } };
}

/**
 * PDF export for desktop / blocked popups: rasterize each print page through html-to-image and
 * combine them with the shared pdf pipeline.
 */
export async function exportSheetPdf(
  snapshot: WorkbookSnapshot,
  sheetId: string | null,
  options: SheetPrintOptions,
  range: CellRange | null = null,
): Promise<ToolResult<Uint8Array>> {
  const model = buildSheetPrintModel(snapshot, sheetId, range);
  if (!model) return { ok: false, error: 'EMPTY' };
  const pages = paginateSheet(model, options);
  if (pages.length === 0) return { ok: false, error: 'EMPTY' };

  try {
    const [{ toPng }, { imagesToPdf }] = await Promise.all([
      import('html-to-image'),
      import('@/core/pdf/convert'),
    ]);
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    Object.assign(host.style, {
      position: 'fixed',
      left: '-99999px',
      top: '0',
      background: '#fff',
    });
    document.body.appendChild(host);
    const images: { bytes: Uint8Array; mime: string }[] = [];
    try {
      host.innerHTML = buildSheetPrintHtml(model, pages, options, model.sheetName || 'sheet');
      const sections = Array.from(host.querySelectorAll<HTMLElement>('.print-page'));
      for (const section of sections) {
        const dataUrl = await toPng(section, { pixelRatio: 2, backgroundColor: '#ffffff' });
        const base64 = dataUrl.split(',')[1] ?? '';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        images.push({ bytes, mime: 'image/png' });
      }
    } finally {
      host.remove();
    }
    return await imagesToPdf(images);
  } catch {
    return { ok: false, error: 'PRINT_FAILED' };
  }
}
