import type { ToolResult } from '@/core/types';
import {
  MIN_COLUMN_COUNT,
  MIN_ROW_COUNT,
  checkImportFile,
  columnWidthToPx,
  excelStyleToUniver,
  parseMergeRange,
  pxToColumnWidth,
  pxToRowHeight,
  rowHeightToPx,
  univerStyleToExcel,
  type ExcelStyleLite,
  type MergeRange,
  type UniverStyleLite,
} from './core';

/**
 * xlsx 适配层：exceljs 全部走动态 import，不进入首屏包
 * （对齐 src/core/pdf/download.ts 中懒加载 jszip 的写法）。
 * 数据只在浏览器内流转，不做任何外发。
 */

/** exceljs Worksheet 的结构化视图：只声明本工具用到的成员，避免与官方类型的字段冲突 */
interface WorksheetLike {
  name: string;
  model?: { merges?: string[] };
  views?: { state?: string; xSplit?: number; ySplit?: number }[];
  getColumn(index: number): { width?: number };
  getRow(index: number): { height?: number };
}

export interface CellSnapshot {
  v?: string | number | boolean;
  f?: string;
  s?: UniverStyleLite;
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

/** ExcelJS 单元格值 → 快照值（公式 / 富文本 / 日期 / 错误） */
function toCellValue(value: unknown): { v?: string | number | boolean; f?: string } {
  if (value === null || value === undefined) return {};
  if (value instanceof Date) return { v: value.toISOString().slice(0, 10) };
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.formula === 'string') {
      const result = record.result;
      return {
        f: record.formula.startsWith('=') ? record.formula : `=${record.formula}`,
        ...(typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean'
          ? { v: result }
          : {}),
      };
    }
    if (Array.isArray(record.richText)) {
      return {
        v: record.richText.map((piece) => String((piece as { text?: string }).text ?? '')).join(''),
      };
    }
    if (typeof record.text === 'string') return { v: record.text };
    // 错误单元格 / 超链接容器：无有效值
    return {};
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { v: value };
  }
  return {};
}

/** 读取列宽 / 行高 / 冻结窗格等结构信息 */
function collectStructure(
  worksheet: WorksheetLike,
  sheet: SheetSnapshot,
  maxRow: number,
  maxColumn: number,
): void {
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

  const view = worksheet.views?.find((item) => item.state === 'frozen');
  if (view) {
    const xSplit = view.xSplit ?? 0;
    const ySplit = view.ySplit ?? 0;
    sheet.freeze = { xSplit, ySplit, startRow: ySplit, startColumn: xSplit };
  }
}

/** 导入 .xlsx：exceljs 解析 → Univer 工作簿快照 */
export async function importXlsxToSnapshot(file: File): Promise<ToolResult<WorkbookSnapshot>> {
  const check = checkImportFile(file);
  if (!check.ok) return check;
  try {
    const buffer = await file.arrayBuffer();
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheets: Record<string, SheetSnapshot> = {};
    const sheetOrder: string[] = [];

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
          const { v, f } = toCellValue(cell.value);
          if (v === undefined && f === undefined) return;
          const rowKey = String(rowNumber - 1);
          const colKey = String(colNumber - 1);
          sheet.cellData[rowKey] = sheet.cellData[rowKey] ?? {};
          const target: CellSnapshot = {};
          if (v !== undefined) target.v = v;
          if (f !== undefined) target.f = f;
          const style = excelStyleToUniver(cell.style as unknown as ExcelStyleLite);
          if (Object.keys(style).length > 0) target.s = style;
          sheet.cellData[rowKey][colKey] = target;
        });
      });

      sheet.rowCount = Math.max(MIN_ROW_COUNT, maxRow + 20);
      sheet.columnCount = Math.max(MIN_COLUMN_COUNT, maxColumn + 4);
      collectStructure(worksheet as unknown as WorksheetLike, sheet, maxRow, maxColumn);

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

    for (const sheetId of snapshot.sheetOrder) {
      const sheet = snapshot.sheets[sheetId];
      if (!sheet) continue;
      const worksheet = workbook.addWorksheet(sheet.name || 'Sheet1');

      for (const [rowKey, rowCells] of Object.entries(sheet.cellData)) {
        const rowIndex = Number(rowKey) + 1;
        for (const [colKey, cell] of Object.entries(rowCells)) {
          const columnIndex = Number(colKey) + 1;
          const target = worksheet.getCell(rowIndex, columnIndex);
          if (cell.f) {
            target.value = {
              formula: cell.f.replace(/^=/, ''),
              result: typeof cell.v === 'number' ? cell.v : undefined,
            };
          } else if (cell.v !== undefined) {
            target.value = cell.v;
          } else {
            continue;
          }
          if (cell.s) {
            target.style = univerStyleToExcel(cell.s) as never;
          }
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

      const freeze = sheet.freeze;
      if (freeze && (freeze.xSplit > 0 || freeze.ySplit > 0)) {
        worksheet.views = [{ state: 'frozen', xSplit: freeze.xSplit, ySplit: freeze.ySplit }];
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return { ok: true, value: new Uint8Array(buffer as ArrayBuffer) };
  } catch {
    return { ok: false, error: 'EXPORT_FAILED' };
  }
}
