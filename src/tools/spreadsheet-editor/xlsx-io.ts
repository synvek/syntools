import type { ToolResult } from '@/core/types';
import {
  MIN_COLUMN_COUNT,
  MIN_ROW_COUNT,
  argbToHex,
  cellDocumentToRichText,
  checkImportFile,
  columnWidthToPx,
  dateToExcelSerial,
  excelStyleToUniver,
  hexToArgb,
  hiddenToWorksheetState,
  parseMergeRange,
  pxToColumnWidth,
  pxToRowHeight,
  richTextToCellDocument,
  rowHeightToPx,
  univerStyleToExcel,
  viewFlagToBooleanNumber,
  worksheetStateToHidden,
  type CellCustomPayload,
  type CellDocumentData,
  type ExcelStyleLite,
  type MergeRange,
  type RichTextPiece,
  type UniverStyleLite,
} from './core';
import { normalizeXlsxArchive } from './xlsx-normalize';
import {
  applySheetExtras,
  collectSheetExtras,
  readWorkbookExtras,
  type SheetExtras,
  type SnapshotWithExtras,
  type WorkbookExtras,
  type WorksheetExtrasLike,
} from './xlsx-extras';
import type { ChartConfig } from './charts';
import type { SheetCommentMap } from './comments';
import { buildChartPlan, injectChartsIntoXlsx } from './chartXml';
import { collectEditorValidation } from './cfdv';
import { collectRawChartParts, type RawChartParts } from './rawChartParts';

/**
 * xlsx adapter layer: exceljs is always dynamically imported so it stays out of the initial bundle
 * (matching the lazy jszip import in src/core/pdf/download.ts). Data only moves inside the browser
 * and is never sent anywhere.
 */

/** Structural view of an exceljs Worksheet: only the members this tool uses, avoiding clashes with the official types */
interface WorksheetLike {
  name: string;
  /** Visibility: visible / hidden / veryHidden */
  state?: string;
  properties?: { tabColor?: { argb?: string; theme?: number } };
  model?: { merges?: string[] };
  views?: {
    state?: string;
    xSplit?: number;
    ySplit?: number;
    showGridLines?: boolean;
    rightToLeft?: boolean;
  }[];
  getColumn(index: number): { width?: number };
  getRow(index: number): { height?: number };
}

export interface CellSnapshot {
  v?: string | number | boolean;
  f?: string;
  s?: UniverStyleLite;
  /** Cell rich text (Univer ICellData.p): preserves per-run font formatting inside a cell */
  p?: CellDocumentData;
  /** Extra payload (Univer ICellData.custom): hyperlink / note / error-value semantics */
  custom?: CellCustomPayload;
}

/** Minimal sheet snapshot aligned with Univer IWorksheetData */
export interface SheetSnapshot {
  id: string;
  name: string;
  tabColor: string;
  hidden: 0 | 1;
  freeze: { xSplit: number; ySplit: number; startRow: number; startColumn: number };
  rowCount: number;
  columnCount: number;
  defaultColumnWidth: number;
  defaultRowHeight: number;
  showGridlines: 0 | 1;
  rightToLeft: 0 | 1;
  rowHeader: { width: number };
  columnHeader: { height: number };
  mergeData: MergeRange[];
  cellData: Record<string, Record<string, CellSnapshot>>;
  columnData: Record<string, { w?: number }>;
  rowData: Record<string, { h?: number }>;
}

/** Minimal workbook snapshot aligned with Univer IWorkbookData */
export interface WorkbookSnapshot extends SnapshotWithExtras {
  id: string;
  name: string;
  appVersion: string;
  locale: 'zhCN' | 'enUS';
  sheetOrder: string[];
  sheets: Record<string, SheetSnapshot>;
  styles: Record<string, unknown>;
  /**
   * Content such as conditional formatting / data validation that is not mapped semantically yet but
   * must survive a round-trip. Kept in our own field rather than Univer resources: a resource without
   * a registered plugin is discarded on load.
   */
  syntoolsExtras?: WorkbookExtras;
  /** In-sheet charts: written as native Excel charts (DrawingML) on export */
  syntoolsCharts?: ChartConfig[];
  /** Native chart parts that came with the imported file (not parsed, written back verbatim on export) */
  syntoolsRawParts?: RawChartParts;
  /** Cell comment threads (P1-2); app-side only, reported as a fidelity warning on export */
  syntoolsComments?: SheetCommentMap;
  /**
   * Univer plugin resources: `resources[pluginName][unitId][sheetId]` carries the rules created in
   * the editor (conditional formatting, data validation). Converted to OOXML on export by `cfdv.ts`.
   */
  resources?: Record<string, unknown>;
}

export function createEmptySheet(id: string, name: string): SheetSnapshot {
  return {
    id,
    name,
    tabColor: '',
    hidden: 0,
    freeze: { xSplit: 0, ySplit: 0, startRow: -1, startColumn: -1 },
    rowCount: MIN_ROW_COUNT,
    columnCount: MIN_COLUMN_COUNT,
    defaultColumnWidth: 93,
    defaultRowHeight: 27,
    showGridlines: 1,
    rightToLeft: 0,
    rowHeader: { width: 46 },
    columnHeader: { height: 20 },
    mergeData: [],
    cellData: {},
    columnData: {},
    rowData: {},
  };
}

/** Create an empty workbook snapshot */
export function createEmptySnapshot(
  title = 'workbook',
  locale: WorkbookSnapshot['locale'] = 'zhCN',
): WorkbookSnapshot {
  const sheetId = `sheet-${Date.now().toString(36)}`;
  return {
    id: sheetId,
    name: title,
    appVersion: '1.0.0',
    locale,
    sheetOrder: [sheetId],
    sheets: { [sheetId]: createEmptySheet(sheetId, 'Sheet1') },
    styles: {},
  };
}

/** Structural view of an exceljs Cell: only the members this tool uses */
interface ExcelCellLike {
  value: unknown;
  style?: unknown;
  numFmt?: string;
  /** Hyperlink URL (exceljs hangs the URL directly on this property) */
  hyperlink?: string;
  /** Note: exceljs returns a string, or a Comment object carrying texts */
  note?: unknown;
}

/** Keep 6 decimal places on serials so float noise does not drift across a round-trip */
function roundSerial(serial: number): number {
  return Math.round(serial * 1e6) / 1e6;
}

/** Read note text (either a plain string or a Comment.texts object) */
function readNoteText(note: unknown): string | undefined {
  if (typeof note === 'string') return note.trim() ? note : undefined;
  if (note && typeof note === 'object') {
    const texts = (note as { texts?: { text?: string }[] }).texts;
    if (Array.isArray(texts)) {
      const joined = texts.map((item) => item?.text ?? '').join('');
      return joined.trim() ? joined : undefined;
    }
  }
  return undefined;
}

/**
 * exceljs cell → Univer cell snapshot.
 * Preserves dates (Excel serial + number format), error values, hyperlinks, notes and cell rich text
 * so an import never silently drops content; returns null for a cell with nothing in it.
 */
function convertCell(cell: ExcelCellLike, row: number, col: number): CellSnapshot | null {
  const target: CellSnapshot = {};
  const custom: CellCustomPayload = {};
  const numFmt = typeof cell.numFmt === 'string' ? cell.numFmt : undefined;
  const value = cell.value;

  if (value instanceof Date) {
    // An Excel date is really "serial + date format": degrading it to a string loses both type and format
    target.v = roundSerial(dateToExcelSerial(value));
    target.s = { n: { pattern: numFmt || 'yyyy-mm-dd' } };
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.formula === 'string') {
      target.f = record.formula.startsWith('=') ? record.formula : `=${record.formula}`;
      const result = record.result;
      if (result instanceof Date) {
        target.v = roundSerial(dateToExcelSerial(result));
        target.s = { n: { pattern: numFmt || 'yyyy-mm-dd' } };
      } else if (
        typeof result === 'string' ||
        typeof result === 'number' ||
        typeof result === 'boolean'
      ) {
        target.v = result;
      } else if (
        result &&
        typeof result === 'object' &&
        typeof (result as { error?: string }).error === 'string'
      ) {
        const error = (result as { error: string }).error;
        target.v = error;
        custom.error = error;
      }
    } else if (Array.isArray(record.richText)) {
      const pieces = record.richText as RichTextPiece[];
      target.v = pieces.map((piece) => piece?.text ?? '').join('');
      const doc = richTextToCellDocument(pieces, `cell-${row}-${col}`);
      if (doc) target.p = doc;
    } else if (typeof record.error === 'string') {
      target.v = record.error;
      custom.error = record.error;
    } else if (typeof record.text === 'string' && typeof record.hyperlink === 'string') {
      target.v = record.text;
      custom.hyperlink = { url: record.hyperlink, text: record.text };
    } else if (typeof record.text === 'string') {
      target.v = record.text;
    }
  } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    target.v = value;
  }

  // Hyperlink: exceljs may also hang the URL on cell.hyperlink
  if (!custom.hyperlink && typeof cell.hyperlink === 'string' && cell.hyperlink) {
    custom.hyperlink = {
      url: cell.hyperlink,
      ...(typeof target.v === 'string' ? { text: target.v } : {}),
    };
  }
  const note = readNoteText(cell.note);
  if (note) custom.note = note;
  if (Object.keys(custom).length > 0) target.custom = custom;

  const style = excelStyleToUniver(cell.style as ExcelStyleLite);
  if (Object.keys(style).length > 0) target.s = { ...target.s, ...style };

  if (target.v === undefined && target.f === undefined && !target.p && !target.custom) return null;
  return target;
}

/** Read structural info: visibility / tab colour / view options / column widths / row heights / frozen panes */
function collectStructure(
  worksheet: WorksheetLike,
  sheet: SheetSnapshot,
  maxRow: number,
  maxColumn: number,
): void {
  // Hidden sheets: both hidden and veryHidden normalise to hidden, so a "vanished" sheet is not treated as visible
  sheet.hidden = worksheetStateToHidden(worksheet.state);

  // Tab colour (theme colours need the theme table to resolve; fall back to the default without argb)
  const tabColor = argbToHex(worksheet.properties?.tabColor?.argb);
  if (tabColor) sheet.tabColor = tabColor;

  // View-level options: keep the snapshot defaults (gridlines on / LTR) when the fields are absent
  const firstView = worksheet.views?.[0];
  sheet.showGridlines = viewFlagToBooleanNumber(firstView?.showGridLines, sheet.showGridlines);
  sheet.rightToLeft = viewFlagToBooleanNumber(firstView?.rightToLeft, sheet.rightToLeft);

  const merges = worksheet.model?.merges ?? [];
  for (const range of merges) {
    const parsed = parseMergeRange(range);
    if (parsed.ok) sheet.mergeData.push(parsed.value);
  }

  for (let column = 1; column <= Math.max(maxColumn, 1); column += 1) {
    const width = worksheet.getColumn(column).width;
    const px = columnWidthToPx(width);
    if (px) sheet.columnData[String(column - 1)] = { w: px };
  }

  for (let row = 1; row <= Math.max(maxRow, 1); row += 1) {
    const height = worksheet.getRow(row).height;
    const px = rowHeightToPx(height);
    if (px) sheet.rowData[String(row - 1)] = { h: px };
  }

  // Frozen panes
  const frozen = worksheet.views?.find((item) => item.state === 'frozen');
  if (frozen) {
    const xSplit = frozen.xSplit ?? 0;
    const ySplit = frozen.ySplit ?? 0;
    sheet.freeze = { xSplit, ySplit, startRow: ySplit, startColumn: xSplit };
  }
}

/**
 * Collect the "native chart" parts from the archive (drawings / charts / media and their .rels).
 * Returns null on failure or when there are no charts — a failed collection never blocks a normal
 * import.
 */
async function collectRawChartPartsFrom(buffer: ArrayBuffer): Promise<RawChartParts | null> {
  try {
    const JSZip = (await import('jszip')).default;
    return await collectRawChartParts(await JSZip.loadAsync(buffer));
  } catch {
    return null;
  }
}

/** Import .xlsx: exceljs parse → Univer workbook snapshot */
export async function importXlsxToSnapshot(file: File): Promise<ToolResult<WorkbookSnapshot>> {
  const check = checkImportFile(file);
  if (!check.ok) return check;
  try {
    const buffer = await file.arrayBuffer();
    // Collect native chart parts first (not parsed, just kept verbatim for the export to write back)
    const rawParts = await collectRawChartPartsFrom(buffer);
    // Then normalise comment relationships: the way openpyxl and friends write them makes exceljs throw, blocking the whole import
    const normalized = await normalizeXlsxArchive(buffer);
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(normalized);

    const sheets: Record<string, SheetSnapshot> = {};
    const sheetOrder: string[] = [];
    const sheetExtras: Record<string, SheetExtras> = {};

    workbook.eachSheet((worksheet, sheetId) => {
      const id = String(sheetId);
      const name = worksheet.name || `Sheet${sheetOrder.length + 1}`;
      const sheet = createEmptySheet(id, name);
      let maxRow = 0;
      let maxColumn = 0;

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        maxRow = Math.max(maxRow, rowNumber);
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          maxColumn = Math.max(maxColumn, colNumber);
          const rowKey = String(rowNumber - 1);
          const colKey = String(colNumber - 1);
          const target = convertCell(
            cell as unknown as ExcelCellLike,
            Number(rowKey),
            Number(colKey),
          );
          if (!target) return;
          sheet.cellData[rowKey] = sheet.cellData[rowKey] ?? {};
          sheet.cellData[rowKey][colKey] = target;
        });
      });

      sheet.rowCount = Math.max(MIN_ROW_COUNT, maxRow + 20);
      sheet.columnCount = Math.max(MIN_COLUMN_COUNT, maxColumn + 4);
      collectStructure(worksheet as unknown as WorksheetLike, sheet, maxRow, maxColumn);

      // Conditional formatting / data validation: not mapped semantically yet, kept with the snapshot and written back on export
      const extras = collectSheetExtras(worksheet as unknown as WorksheetExtrasLike);
      if (extras) sheetExtras[name] = extras;

      sheets[id] = sheet;
      sheetOrder.push(id);
    });

    if (sheetOrder.length === 0) return { ok: false, error: 'EMPTY' };

    return {
      ok: true,
      value: {
        id: `workbook-${Date.now().toString(36)}`,
        name: file.name.replace(/\.xlsx?$/i, ''),
        appVersion: '1.0.0',
        locale: 'zhCN',
        sheetOrder,
        sheets,
        styles: {},
        ...(Object.keys(sheetExtras).length > 0
          ? { syntoolsExtras: { version: 1 as const, sheets: sheetExtras } }
          : {}),
        ...(rawParts ? { syntoolsRawParts: rawParts } : {}),
      },
    };
  } catch {
    return { ok: false, error: 'IMPORT_FAILED' };
  }
}

/** Export .xlsx: Univer workbook snapshot → xlsx bytes */
export async function exportSnapshotToBytes(
  snapshot: WorkbookSnapshot,
): Promise<ToolResult<Uint8Array>> {
  try {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SynTools';
    workbook.created = new Date();
    // Conditional formatting / data validation: saved with the snapshot on import, written back here
    const extras = readWorkbookExtras(snapshot);

    let firstWorksheet: ReturnType<typeof workbook.addWorksheet> | null = null;
    let worksheetCount = 0;
    let hiddenCount = 0;

    for (const sheetId of snapshot.sheetOrder) {
      const sheet = snapshot.sheets[sheetId];
      if (!sheet) continue;
      const sheetName = sheet.name || 'Sheet1';
      const worksheet = workbook.addWorksheet(sheetName);
      firstWorksheet ??= worksheet;
      worksheetCount += 1;
      if (sheet.hidden) hiddenCount += 1;

      // Visibility and tab colour: preserve whatever the user or Excel had
      worksheet.state = hiddenToWorksheetState(sheet.hidden);
      const tabArgb = hexToArgb(sheet.tabColor);
      if (tabArgb) worksheet.properties.tabColor = { argb: tabArgb };

      const sheetExtras = extras?.sheets?.[sheetName];
      if (sheetExtras) applySheetExtras(worksheet as unknown as WorksheetExtrasLike, sheetExtras);

      // Rules created inside the editor live in snapshot resources (not in syntoolsExtras); convert + write them
      const editorRules = collectEditorValidation(snapshot, sheetId);
      if (
        editorRules.conditionalFormattings.length > 0 ||
        Object.keys(editorRules.dataValidations).length > 0
      ) {
        applySheetExtras(worksheet as unknown as WorksheetExtrasLike, {
          conditionalFormattings: editorRules.conditionalFormattings,
          dataValidations: editorRules.dataValidations,
        });
      }

      for (const [rowKey, rowCells] of Object.entries(sheet.cellData)) {
        const rowIndex = Number(rowKey) + 1;
        for (const [colKey, cell] of Object.entries(rowCells)) {
          const columnIndex = Number(colKey) + 1;
          const target = worksheet.getCell(rowIndex, columnIndex);
          const note = cell.custom?.note;
          // Restore in order: formula → error value → hyperlink → rich text → plain value
          if (cell.f) {
            target.value = {
              formula: cell.f.replace(/^=/, ''),
              result:
                typeof cell.v === 'number' ||
                typeof cell.v === 'string' ||
                typeof cell.v === 'boolean'
                  ? cell.v
                  : undefined,
            };
          } else if (cell.custom?.error) {
            target.value = { error: cell.custom.error } as never;
          } else if (cell.custom?.hyperlink) {
            target.value = {
              text: cell.custom.hyperlink.text ?? cell.custom.hyperlink.url,
              hyperlink: cell.custom.hyperlink.url,
            } as never;
          } else if (cell.p) {
            target.value = { richText: cellDocumentToRichText(cell.p) } as never;
          } else if (cell.v !== undefined) {
            target.value = cell.v;
          } else if (!note && !cell.s) {
            // Skip truly blank cells, but still write cells that only carry a note or a style
            continue;
          }
          if (cell.s) {
            target.style = univerStyleToExcel(cell.s) as never;
          }
          // Note: write it back as the cell comment
          if (note) target.note = note;
        }
      }

      for (const merge of sheet.mergeData ?? []) {
        worksheet.mergeCells(
          merge.startRow + 1,
          merge.startColumn + 1,
          merge.endRow + 1,
          merge.endColumn + 1,
        );
      }

      for (const [colKey, column] of Object.entries(sheet.columnData ?? {})) {
        const width = pxToColumnWidth(column.w);
        if (width) worksheet.getColumn(Number(colKey) + 1).width = width;
      }

      for (const [rowKey, rowItem] of Object.entries(sheet.rowData ?? {})) {
        const height = pxToRowHeight(rowItem.h);
        if (height) worksheet.getRow(Number(rowKey) + 1).height = height;
      }

      // View: frozen panes + gridline visibility + right-to-left (only written when needed, to avoid pointless changes)
      const freeze = sheet.freeze;
      const frozen = freeze && (freeze.xSplit > 0 || freeze.ySplit > 0) ? freeze : null;
      const wantGrid = sheet.showGridlines === 0;
      const wantRtl = sheet.rightToLeft === 1;
      if (frozen || wantGrid || wantRtl) {
        // Build a concrete shape (not the Partial<WorksheetView> union) so spreading cannot create a union conflict
        const common = {
          ...(wantGrid ? { showGridLines: false } : {}),
          ...(wantRtl ? { rightToLeft: true } : {}),
        };
        if (frozen) {
          worksheet.views = [
            { state: 'frozen', xSplit: frozen.xSplit, ySplit: frozen.ySplit, ...common },
          ];
        } else {
          worksheet.views = [{ state: 'normal', ...common }];
        }
      }
    }

    // Excel requires at least one visible sheet: force the first one visible when all are hidden
    if (worksheetCount > 0 && hiddenCount === worksheetCount && firstWorksheet) {
      firstWorksheet.state = 'visible';
    }

    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
    // Charts: in-app charts become native Excel charts (DrawingML); native charts kept from import are written back verbatim
    const plan = buildChartPlan(snapshot);
    const needsInjection = Object.keys(plan.chartsBySheet).length > 0 || plan.passthrough !== null;
    const bytes = needsInjection ? await injectChartsIntoXlsx(buffer, plan) : buffer;
    return { ok: true, value: new Uint8Array(bytes) };
  } catch {
    return { ok: false, error: 'EXPORT_FAILED' };
  }
}
