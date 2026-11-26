import type { ToolResult } from '@/core/types';
import {
  MIN_COLUMN_COUNT,
  MIN_ROW_COUNT,
  excelColorToHex,
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
import { readXlsxThemePalette, type ThemePalette } from './xlsx-theme';
import { createTextMeasure, shrinkFontSize, type TextMeasure } from './textMeasure';
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
import type { PivotConfig } from './pivot';
import type { SheetCommentMap } from './comments';
import { buildThreadNotes, threadNotesForSheet } from './commentsXlsx';
import { collectEditorValidation } from './cfdv';
import { collectRawChartParts, type RawChartParts } from './rawChartParts';
import { adoptChartParts, metricsOfSheet } from './chartAdopt';
import { spanMetricsOfSheet } from './chartXml';
import { collectSheetShapes } from './shapesXml';
import { collectSheetImages } from './imagesXml';
import { createConvertedAnchors, pruneConvertedAnchors } from './drawingAnchors';
import type { SheetImageConfig } from './sheetImages';
import type { SheetShapeConfig } from './shapes';
import { readNamedRangesFromXlsx, type NamedRange } from './namedRanges';
import { runXlsxPostProcess } from './xlsxPostProcess';
import {
  applySheetProtection,
  readSheetProtection,
  type SheetProtectionState,
  type WorksheetProtectionLike,
} from './sheetProtection';
import { readSheetTables, type SheetTable } from './sheetTables';
import { diagnoseXlsxArchive } from './xlsx-diagnose';
import { collectImportIssues } from './importFidelity';
import { reportSheetIssue } from './issues';
import { exportSnapshotInWorker, importXlsxInWorker } from './sheetWorkerClient';
import type { FidelityIssue } from '@/core/fidelity';

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
  /** Floating shapes on sheets (SHEET-02): written as native `xdr:sp` on export */
  syntoolsShapes?: SheetShapeConfig[];
  /** Floating pictures on sheets (SHEET-02 剩余): written as `xdr:pic` + `xl/media/imageN.<ext>` */
  syntoolsImages?: SheetImageConfig[];
  /** Cell comment threads (P1-2); app-side only, reported as a fidelity warning on export */
  syntoolsComments?: SheetCommentMap;
  /**
   * Pivot table configs (P2-4): an analysis view over a source range. App-side only.
   * Export writes the result as a value sheet and, when the shape allows it, injects native
   * `pivotTable` / `pivotCacheDefinition` parts so the table stays refreshable in Excel.
   */
  syntoolsPivots?: PivotConfig[];
  /**
   * 透视结果工作表 → 生成它的配置 id（导出时用来注入原生透视表 part）。
   * 只在导出的临时快照上出现，不持久化。
   */
  syntoolsPivotSheets?: { sheetId: string; configId: string }[];
  /**
   * Univer plugin resources: `resources[pluginName][unitId][sheetId]` carries the rules created in
   * the editor (conditional formatting, data validation). Converted to OOXML on export by `cfdv.ts`.
   */
  resources?: Record<string, unknown>;
  /**
   * Workbook-scoped / sheet-scoped names (P2-S7.1). Written as `<definedNames>` in workbook.xml;
   * kept outside Univer because neither the model nor the formula engine knows about names.
   */
  namedRanges?: NamedRange[];
  /**
   * Sheet protection (P2-S7.2). Written as `<sheetProtection>` on export and read back on import;
   * the editor also uses it to switch the sheet to read-only.
   */
  syntoolsProtection?: SheetProtectionState[];
  /**
   * Table objects / ListObject (P2-S7.3). Written as native `xl/tables/tableN.xml` parts
   * (exceljs's own `addTable` would overwrite the cells it covers), read back from `worksheet.tables`.
   */
  syntoolsTables?: SheetTable[];
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
function convertCell(
  cell: ExcelCellLike,
  row: number,
  col: number,
  palette?: ThemePalette,
): CellSnapshot | null {
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
      const doc = richTextToCellDocument(pieces, `cell-${row}-${col}`, palette);
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

  const excelStyle = cell.style as ExcelStyleLite;
  const shrink = excelStyle?.alignment?.shrinkToFit;
  if (shrink) {
    // Scaled to the real column width right after the sheet's columns are read (applyShrinkToFit)
    custom.shrinkToFit = {
      fs: typeof excelStyle?.font?.size === 'number' ? excelStyle.font.size : 0,
    };
  }

  if (Object.keys(custom).length > 0) target.custom = custom;

  const style = excelStyleToUniver(excelStyle, palette);
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
  palette?: ThemePalette,
): void {
  // Hidden sheets: both hidden and veryHidden normalise to hidden, so a "vanished" sheet is not treated as visible
  sheet.hidden = worksheetStateToHidden(worksheet.state);

  // Tab colour (a theme tab colour is resolved through the workbook palette, like any other colour)
  const tabColor = excelColorToHex(worksheet.properties?.tabColor, palette);
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

/** Excel's default cell font size, used when the shrink-to-fit cell inherits its font */
const DEFAULT_FONT_PT = 11;
/** Univer keeps a little padding inside the cell; measuring against the full width would over-shrink */
const CELL_PADDING_PX = 6;

/** The text a cell actually renders (rich text keeps its runs in `p`, plain values in `v`) */
function displayTextOf(cell: CellSnapshot): string {
  const stream = cell.p?.body?.dataStream;
  if (stream) return stream.replace(/\r\n$/, '');
  if (typeof cell.v === 'string') return cell.v;
  if (typeof cell.v === 'number' || typeof cell.v === 'boolean') return String(cell.v);
  return '';
}

/**
 * Shrink-to-fit ("缩小字体填充"): Univer has no notion of it — it draws the nominal size and clips — so the
 * size Excel would have picked is measured here against the real column width and stored as the cell's
 * font size. The authored size stays in `custom.shrinkToFit` so export can write back
 * `<alignment shrinkToFit="1"/>` with the original font size.
 *
 * Runs after the columns are read, because the computation needs their width.
 */
function applyShrinkToFit(sheet: SheetSnapshot, measure: TextMeasure): void {
  for (const [rowKey, row] of Object.entries(sheet.cellData)) {
    for (const [colKey, cell] of Object.entries(row)) {
      const shrink = cell.custom?.shrinkToFit;
      if (!shrink) continue;
      const fontPt = shrink.fs > 0 ? shrink.fs : DEFAULT_FONT_PT;
      const width = sheet.columnData[colKey]?.w ?? sheet.defaultColumnWidth;
      const next = shrinkFontSize(
        displayTextOf(cell),
        fontPt,
        cell.s?.ff,
        width - CELL_PADDING_PX,
        measure,
      );
      shrink.fs = fontPt;
      if (next !== null) cell.s = { ...cell.s, fs: next };
      sheet.cellData[rowKey] = row;
    }
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
  } catch (error) {
    // Charts would otherwise vanish without a trace: the import still succeeds, the user is told
    reportSheetIssue({ code: 'chartPartsUnreadable', level: 'notice', detail: String(error) });
    return null;
  }
}

/**
 * Import-side fidelity sink (P0-4). Passing one in makes the import report what it could not keep;
 * callers without a sink (older tests, CSV paths) are unaffected.
 */
export interface ImportOutcome {
  /** Filled once the import succeeds: degradations detected from the archive */
  issues: FidelityIssue[];
}

/**
 * 导入实现只需要这三个成员。刻意不用 `File`：worker 里没有理由为了拿字节再造一个 File，
 * 而 jsdom 的 `File` 没有 `arrayBuffer()`（单测所以一直用结构等价的假文件）。
 */
export interface ImportFileLike {
  name: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * 导入 .xlsx 的**同步实现**（P2-1）：exceljs 解析 → Univer 快照。
 *
 * UI 层不要直接调它——那是"把最贵的一段留在主线程"。它现在的身份有两个：
 * ① `importXlsxToSnapshot` 在 worker 不可用时的退路；② sheet worker 内部的真正实现
 * （同一条代码路径两条线程复用，行为差异只可能来自运行环境）。
 */
export async function importXlsxInThread(
  file: ImportFileLike,
  outcome?: ImportOutcome,
): Promise<ToolResult<WorkbookSnapshot>> {
  const check = checkImportFile(file);
  if (!check.ok) return check;
  try {
    const buffer = await file.arrayBuffer();
    // Classify the container before exceljs sees it: "encrypted" and "corrupted" need different
    // user actions, and a ZIP without a workbook part is not a workbook at all (P0-2).
    const diagnosis = await diagnoseXlsxArchive(buffer);
    if (!diagnosis.ok) return diagnosis;
    const archiveParts = diagnosis.parts;
    // Collect native chart parts first (not parsed, just kept verbatim for the export to write back)
    const rawGathered = await collectRawChartPartsFrom(buffer);
    // Then normalise comment relationships: the way openpyxl and friends write them makes exceljs throw, blocking the whole import
    const normalized = await normalizeXlsxArchive(buffer);
    // The workbook's own theme: `<color theme="4"/>` only means something against this palette
    const themePalette = await readXlsxThemePalette(normalized);
    // Shrink-to-fit needs real glyph widths, measured once per import
    const measureText = createTextMeasure();
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(normalized);
    } catch {
      // The container was a valid ZIP with a workbook part, so this is a producer-specific part we
      // cannot read — not a corrupt download (that is NOT_ZIP one level up).
      return { ok: false, error: 'PART_UNREADABLE' };
    }

    const sheets: Record<string, SheetSnapshot> = {};
    const sheetOrder: string[] = [];
    const sheetExtras: Record<string, SheetExtras> = {};
    // Sheet protection (P2-S7.2): read per sheet below, restored on export and used for the read-only switch
    const protections: SheetProtectionState[] = [];
    // Table objects (P2-S7.3): exceljs exposes them as `worksheet.tables` without touching cells
    const collectedTables: SheetTable[] = [];

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
            themePalette,
          );
          if (!target) return;
          sheet.cellData[rowKey] = sheet.cellData[rowKey] ?? {};
          sheet.cellData[rowKey][colKey] = target;
        });
      });

      sheet.rowCount = Math.max(MIN_ROW_COUNT, maxRow + 20);
      sheet.columnCount = Math.max(MIN_COLUMN_COUNT, maxColumn + 4);
      collectStructure(
        worksheet as unknown as WorksheetLike,
        sheet,
        maxRow,
        maxColumn,
        themePalette,
      );
      // After the columns: the shrunk size depends on the real column width
      applyShrinkToFit(sheet, measureText);

      // Conditional formatting / data validation: not mapped semantically yet, kept with the snapshot and written back on export
      const extras = collectSheetExtras(worksheet as unknown as WorksheetExtrasLike);
      if (extras) sheetExtras[name] = extras;

      const protection = readSheetProtection(worksheet as unknown as WorksheetProtectionLike);
      if (protection) protections.push({ ...protection, sheetId: id });

      const tables = readSheetTables(worksheet as unknown as { tables?: unknown }, id);
      if (tables.length > 0) collectedTables.push(...tables);

      sheets[id] = sheet;
      sheetOrder.push(id);
    });

    if (sheetOrder.length === 0) return { ok: false, error: 'EMPTY' };

    // Floating shapes / pictures are read from the drawing parts (exceljs drops them like every other
    // drawing). They are parsed **after** the sheets so the cell-span → pixel maths can use the real
    // column widths / row heights: Excel writes `twoCellAnchor` with `cx=0 cy=0` and puts the size in
    // `from`/`to`, so a default-width guess would resize every imported picture.
    // `converted` records which anchors became app-side configs, so the preserved drawing can drop
    // exactly those — keeping them would export the same shape/picture twice (verbatim + regenerated).
    const converted = createConvertedAnchors();
    const spanMetricsByName = Object.fromEntries(
      Object.entries(sheets)
        .filter(([, sheet]) => Boolean(sheet.name))
        .map(([, sheet]) => [sheet.name as string, spanMetricsOfSheet(sheet)]),
    );
    const shapesByName = await collectSheetShapes(buffer, converted.add, spanMetricsByName);
    const imagesByName = await collectSheetImages(buffer, converted.add, spanMetricsByName);
    const rawParts = pruneConvertedAnchors(rawGathered, converted);

    // Sheet names are the only stable link between a drawing and our snapshot ids
    const importedShapes: SheetShapeConfig[] = [];
    for (const [name, list] of Object.entries(shapesByName)) {
      const sheetId = Object.entries(sheets).find(([, sheet]) => sheet.name === name)?.[0];
      if (!sheetId) continue;
      for (const shape of list) {
        importedShapes.push({
          ...shape,
          id: `shape-import-${importedShapes.length + 1}`,
          sheetId,
          z: importedShapes.length,
        });
      }
    }

    const importedImages: SheetImageConfig[] = [];
    for (const [name, list] of Object.entries(imagesByName)) {
      const sheetId = Object.entries(sheets).find(([, sheet]) => sheet.name === name)?.[0];
      if (!sheetId) continue;
      for (const image of list) {
        importedImages.push({
          ...image,
          id: `image-import-${importedImages.length + 1}`,
          sheetId,
          z: importedImages.length,
        });
      }
    }

    // Names live in workbook.xml (exceljs drops `localSheetId`, so they are read from the raw part)
    const namedRanges = await readNamedRangesFromXlsx(normalized, sheetOrder, sheets);

    // Charts "import as editable": translate every native chart we can read into a ChartConfig and
    // drop its part from the preserved set — keeping both would write the same chart twice on export.
    // Anything we cannot express stays a verbatim part (see chartAdopt).
    const charts = adoptChartParts(rawParts, {
      sheetIdsByName: Object.fromEntries(
        Object.entries(sheets)
          .filter(([, sheet]) => Boolean(sheet.name))
          .map(([id, sheet]) => [sheet.name as string, id]),
      ),
      metricsByName: Object.fromEntries(
        Object.entries(sheets)
          .filter(([, sheet]) => Boolean(sheet.name))
          .map(([, sheet]) => [sheet.name as string, metricsOfSheet(sheet)]),
      ),
    });

    // Import-side report (P0-4): the facts are the archive parts we just read plus the charts that
    // stayed verbatim, so nothing is claimed that the code cannot point at.
    if (outcome) {
      const rawChartCount = Object.keys(charts.parts?.parts ?? {}).filter((part) =>
        /^xl\/charts\/[^/]+\.xml$/i.test(part),
      ).length;
      outcome.issues.push(...collectImportIssues({ parts: archiveParts, rawChartCount }));
    }

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
        ...(charts.charts.length > 0 ? { syntoolsCharts: charts.charts } : {}),
        ...(charts.parts ? { syntoolsRawParts: charts.parts } : {}),
        ...(importedShapes.length > 0 ? { syntoolsShapes: importedShapes } : {}),
        ...(importedImages.length > 0 ? { syntoolsImages: importedImages } : {}),
        ...(namedRanges.length > 0 ? { namedRanges } : {}),
        ...(protections.length > 0 ? { syntoolsProtection: protections } : {}),
        ...(collectedTables.length > 0 ? { syntoolsTables: collectedTables } : {}),
      },
    };
  } catch {
    return { ok: false, error: 'IMPORT_FAILED' };
  }
}

/**
 * 导入 .xlsx（P2-1）：优先交给 sheet worker 解析，拿不到线程就回落到同步实现。
 *
 * 三条分支的语义（与 `sheetWorkerClient` 的返回值一一对应，没有第四种）：
 * - `ok`：worker 解析完成，保真问题与 worker 内的降级提示一并带回；
 * - `failed`：文件本身读不了（加密 / 非 zip / 部件坏了），**不重试**——换线程是同一个结果，
 *   重试只会让用户多等一遍；
 * - `unavailable`：线程起不来 / 崩溃 / 超时，退回 `importXlsxInThread`，功能不受影响，只是慢。
 */
export async function importXlsxToSnapshot(
  file: File,
  outcome?: ImportOutcome,
): Promise<ToolResult<WorkbookSnapshot>> {
  const check = checkImportFile(file);
  if (!check.ok) return check;
  const offloaded = await importXlsxInWorker(file);
  if (offloaded.status === 'ok') {
    if (outcome) outcome.issues.push(...offloaded.issues);
    // worker 里的 `reportSheetIssue` 播报到的是 worker 自己的模块状态，必须在这里重播一次，
    // 否则"原生图表部件读不出来"这类提示会随线程一起消失
    for (const notice of offloaded.notices) reportSheetIssue(notice);
    return { ok: true, value: offloaded.snapshot };
  }
  if (offloaded.status === 'failed') return { ok: false, error: offloaded.error };
  return importXlsxInThread(file, outcome);
}

/** Export .xlsx 的**同步实现**（P2-1）：快照 → xlsx 字节。worker 与主线程共用，同 `importXlsxInThread` */
export async function exportSnapshotInThread(
  snapshot: WorkbookSnapshot,
): Promise<ToolResult<Uint8Array>> {
  try {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SynTools';
    workbook.created = new Date();
    // Conditional formatting / data validation: saved with the snapshot on import, written back here
    const extras = readWorkbookExtras(snapshot);
    // Comment threads become legacy notes (P1-9); computed once, applied per sheet below
    const threadNotes = buildThreadNotes(snapshot);

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

      // Protection (P2-S7.2): written straight into the exceljs sheet model, so the OOXML element
      // lands in the required position (after sheetData, before autoFilter)
      applySheetProtection(
        worksheet as unknown as { sheetProtection?: unknown },
        snapshot.syntoolsProtection?.find((item) => item.sheetId === sheetId) ?? null,
      );

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
          if (cell.s || cell.custom?.shrinkToFit) {
            const style = univerStyleToExcel(cell.s ?? {});
            const shrink = cell.custom?.shrinkToFit;
            if (shrink) {
              // Excel shrinks it itself: write the authored size back, plus the alignment flag
              style.font = { ...style.font, size: shrink.fs };
              style.alignment = { ...style.alignment, shrinkToFit: true };
            }
            target.style = style as never;
          }
          // Note: write it back as the cell comment
          if (note) target.note = note;
        }
      }

      // Comment threads → legacy notes (P1-9). Written after the cells so a thread wins over an
      // imported note on the same cell; exceljs emits `xl/commentsN.xml` plus the VML drawing, which
      // is what makes Excel show the note box at all.
      for (const note of threadNotesForSheet(threadNotes, sheetId)) {
        const target = worksheet.getCell(note.row + 1, note.col + 1);
        (target as unknown as { note: string }).note = note.text;
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
    // Native parts exceljs cannot write (charts / pictures / shapes / pivot tables / names / tables)
    // are injected by the registry in `xlsxPostProcess.ts`; the array order there is the layer order
    const bytes = await runXlsxPostProcess(buffer, snapshot);
    return { ok: true, value: new Uint8Array(bytes) };
  } catch {
    return { ok: false, error: 'EXPORT_FAILED' };
  }
}

/**
 * 导出 .xlsx（P2-1）：优先在 sheet worker 里写文件，拿不到线程就回落。
 *
 * 这里的取舍要说清楚：快照必须先**结构化克隆**进 worker（无法 transfer，纯对象），
 * 所以省下的是 exceljs 的建表 + 序列化 + zip 后处理，不是克隆本身。2 万单元格的克隆
 * 是毫秒级、写文件是百毫秒级，这笔账仍然划算；但"零成本"是假的——
 * 千级以下的小表走 worker 反而略慢，故阈值留给实测（见方案 §5 P2-1 偏差说明）。
 */
export async function exportSnapshotToBytes(
  snapshot: WorkbookSnapshot,
): Promise<ToolResult<Uint8Array>> {
  const offloaded = await exportSnapshotInWorker(snapshot);
  if (offloaded.status === 'ok') return { ok: true, value: offloaded.bytes };
  if (offloaded.status === 'failed') return { ok: false, error: offloaded.error };
  return exportSnapshotInThread(snapshot);
}
