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
  withWorkbookExtras,
  type SheetExtras,
  type WorksheetExtrasLike,
} from './xlsx-extras';

/**
 * xlsx 适配层：exceljs 全部走动态 import，不进入首屏包
 * （对齐 src/core/pdf/download.ts 中懒加载 jszip 的写法）。
 * 数据只在浏览器内流转，不做任何外发。
 */

/** exceljs Worksheet 的结构化视图：只声明本工具用到的成员，避免与官方类型的字段冲突 */
interface WorksheetLike {
  name: string;
  /** 可见状态：visible / hidden / veryHidden */
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
  /** 单元格富文本（Univer ICellData.p）：保留单元格内的局部字体格式 */
  p?: CellDocumentData;
  /** 附加载荷（Univer ICellData.custom）：超链接 / 批注 / 错误值语义 */
  custom?: CellCustomPayload;
}

/** 与 Univer IWorksheetData 对齐的最小工作表快照 */
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

/** 与 Univer IWorkbookData 对齐的最小工作簿快照 */
export interface WorkbookSnapshot {
  id: string;
  name: string;
  appVersion: string;
  locale: 'zhCN' | 'enUS';
  sheetOrder: string[];
  sheets: Record<string, SheetSnapshot>;
  styles: Record<string, unknown>;
  /**
   * Univer 会原样保留 workbook 级 resources；本工具用它承载
   * 暂不做语义映射、但需往返保留的内容（条件格式 / 数据验证，见 xlsx-extras）。
   */
  resources?: { name: string; data: string }[];
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

/** 新建空工作簿快照 */
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

/** exceljs Cell 的结构化视图：只声明本工具用到的成员 */
interface ExcelCellLike {
  value: unknown;
  style?: unknown;
  numFmt?: string;
  /** 超链接 URL（exceljs 把 URL 直接挂在该属性上） */
  hyperlink?: string;
  /** 批注：exceljs 读取时为字符串，也可能是含 texts 的 Comment 对象 */
  note?: unknown;
}

/** 序列号保留 6 位小数，避免浮点噪声导致往返漂移 */
function roundSerial(serial: number): number {
  return Math.round(serial * 1e6) / 1e6;
}

/** 读取批注文本（字符串或 Comment.texts 对象两种形态） */
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
 * exceljs 单元格 → Univer 单元格快照。
 * 保留日期（Excel 序列 + 数字格式）、错误值、超链接、批注与单元格富文本，
 * 避免导入时静默丢内容；无任何内容的单元格返回 null。
 */
function convertCell(cell: ExcelCellLike, row: number, col: number): CellSnapshot | null {
  const target: CellSnapshot = {};
  const custom: CellCustomPayload = {};
  const numFmt = typeof cell.numFmt === 'string' ? cell.numFmt : undefined;
  const value = cell.value;

  if (value instanceof Date) {
    // Excel 日期本质是「序列号 + 日期格式」：降级为字符串会同时丢失类型与格式
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

  // 超链接：exceljs 也可能把 URL 挂在 cell.hyperlink 上
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

/** 读取可见状态 / 标签色 / 视图显示 / 列宽 / 行高 / 冻结窗格等结构信息 */
function collectStructure(
  worksheet: WorksheetLike,
  sheet: SheetSnapshot,
  maxRow: number,
  maxColumn: number,
): void {
  // 隐藏工作表：hidden / veryHidden 都归一为隐藏，避免「消失的表」被当成可见
  sheet.hidden = worksheetStateToHidden(worksheet.state);

  // 标签页颜色（主题色需要主题表才能解析，缺少 argb 时保持默认）
  const tabColor = argbToHex(worksheet.properties?.tabColor?.argb);
  if (tabColor) sheet.tabColor = tabColor;

  // 视图级显示选项：字段缺失时保留快照默认（显示网格线 / 非 RTL）
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

  // 冻结窗格
  const frozen = worksheet.views?.find((item) => item.state === 'frozen');
  if (frozen) {
    const xSplit = frozen.xSplit ?? 0;
    const ySplit = frozen.ySplit ?? 0;
    sheet.freeze = { xSplit, ySplit, startRow: ySplit, startColumn: xSplit };
  }
}

/** 导入 .xlsx：exceljs 解析 → Univer 工作簿快照 */
export async function importXlsxToSnapshot(file: File): Promise<ToolResult<WorkbookSnapshot>> {
  const check = checkImportFile(file);
  if (!check.ok) return check;
  try {
    const buffer = await file.arrayBuffer();
    // 先归一化批注关系：openpyxl 等写入器的写法会让 exceljs 直接抛错、整份文件无法导入
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

      // 条件格式 / 数据验证：暂不做语义映射，先随快照保留，导出时写回
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
        resources: withWorkbookExtras(undefined, { version: 1, sheets: sheetExtras }),
      },
    };
  } catch {
    return { ok: false, error: 'IMPORT_FAILED' };
  }
}

/** 导出 .xlsx：Univer 工作簿快照 → xlsx 字节 */
export async function exportSnapshotToBytes(
  snapshot: WorkbookSnapshot,
): Promise<ToolResult<Uint8Array>> {
  try {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SynTools';
    workbook.created = new Date();
    // 条件格式 / 数据验证：导入时随快照保存，这里写回
    const extras = readWorkbookExtras(snapshot.resources);

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

      // 可见状态与标签色：往返保留用户 / Excel 中的设置
      worksheet.state = hiddenToWorksheetState(sheet.hidden);
      const tabArgb = hexToArgb(sheet.tabColor);
      if (tabArgb) worksheet.properties.tabColor = { argb: tabArgb };

      const sheetExtras = extras?.sheets?.[sheetName];
      if (sheetExtras) applySheetExtras(worksheet as unknown as WorksheetExtrasLike, sheetExtras);

      for (const [rowKey, rowCells] of Object.entries(sheet.cellData)) {
        const rowIndex = Number(rowKey) + 1;
        for (const [colKey, cell] of Object.entries(rowCells)) {
          const columnIndex = Number(colKey) + 1;
          const target = worksheet.getCell(rowIndex, columnIndex);
          const note = cell.custom?.note;
          // 依次还原：公式 → 错误值 → 超链接 → 富文本 → 普通值
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
            // 真正空白的单元格跳过；仅批注 / 仅样式的单元格仍需写出
            continue;
          }
          if (cell.s) {
            target.style = univerStyleToExcel(cell.s) as never;
          }
          // 批注：写回单元格备注
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

      // 视图：冻结窗格 + 网格线显示 + 从右到左（仅在需要时才写入，避免无谓改动）
      const freeze = sheet.freeze;
      const frozen = freeze && (freeze.xSplit > 0 || freeze.ySplit > 0) ? freeze : null;
      const wantGrid = sheet.showGridlines === 0;
      const wantRtl = sheet.rightToLeft === 1;
      if (frozen || wantGrid || wantRtl) {
        // 用具体形状（而非 Partial<WorksheetView> 联合类型）拼接，避免展开后产生联合冲突
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

    // Excel 要求至少保留一张可见工作表：全部隐藏时强制第一张可见
    if (worksheetCount > 0 && hiddenCount === worksheetCount && firstWorksheet) {
      firstWorksheet.state = 'visible';
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return { ok: true, value: new Uint8Array(buffer as ArrayBuffer) };
  } catch {
    return { ok: false, error: 'EXPORT_FAILED' };
  }
}
