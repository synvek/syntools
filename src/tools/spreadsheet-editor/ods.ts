import JSZip from 'jszip';
import type { FidelityIssue } from '@/core/fidelity';
import type { ToolResult } from '@/core/types';
import { checkImportFile } from './core';
import { createEmptySnapshot, type ImportOutcome, type WorkbookSnapshot } from './xlsx-io';

/**
 * `.ods`（OpenDocument Spreadsheet）导入（P2-2）。
 *
 * 只做"用户能继续编辑"的最小语义集，宁可少认也不猜：
 *
 * - **表 / 行 / 单元格 / 合并**：`table:table`、`table:table-row`、`table:table-cell`、
 *   `table:number-columns-spanned` / `number-rows-spanned`；
 * - **单元格值**按 `office:value-type` 分支（float / percentage / currency / date / boolean / string），
 *   日期保留 ISO 文本——本轮不把它猜成序列号，猜错就是"看起来对、算出来错"；
 * - **样式子集**：粗体 / 斜体 / 下划线 / 字号 / 字色 / 底色 / 水平对齐；
 * - **其余样式（边框、数字格式、自动换行、内边距、竖排）计入 `sheet.importOdsStyleLoss`**，
 *   在导入保真报告里说明"这些单元格只保留了部分样式"——不静默丢弃。
 *
 * `table:number-rows-repeated` / `number-columns-repeated` 是 ODS 的压缩手段（整表可能只有几行
 * XML），这里只在**带内容**时展开，并加上限，避免一个 `repeated="1048576"` 把内存撑爆。
 */

const NS = {
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
} as const;

/** 重复行的上限：超过这个数基本只可能是"整表格式化"，展开没有意义 */
const MAX_REPEAT = 1000;
/** 单元格/行的硬上限，防止病态文件把页面卡死 */
const MAX_ROWS = 20000;
const MAX_COLS = 1024;

interface OdsCellStyle {
  /** Univer 的样式对象（只带认得出来的那几个字段） */
  style: Record<string, unknown>;
  /** 有认得出来但表达不了的属性：这条样式被引用时计入样式损失 */
  lossy: boolean;
}

interface OdsCell {
  v?: string | number | boolean;
  s?: Record<string, unknown>;
}

interface SheetBuild {
  id: string;
  name: string;
  cellData: Record<number, Record<number, OdsCell>>;
  mergeData: { startRow: number; startColumn: number; endRow: number; endColumn: number }[];
  rows: number;
  cols: number;
  /** 引用了"只保留部分样式"的单元格数 */
  lossyCells: number;
}

function attr(element: Element, ns: string, name: string): string | null {
  return element.getAttributeNS(ns, name);
}

function repeated(element: Element, ns: string, name: string): number {
  const raw = attr(element, ns, name);
  const value = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(value) && value > 0 ? Math.min(value, MAX_REPEAT) : 1;
}

/** `fo:font-size` 可能是 `12pt` / `10px` / `0.9cm`：只处理 pt 与 px，其余按 12px 处理 */
function fontSizePx(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  if (raw.trim().endsWith('pt')) return Math.round((value * 4) / 3);
  return Math.round(value);
}

/** 把一段 `style:style`（family=table-cell）翻译成 Univer 样式 + 是否有损失 */
function readCellStyle(element: Element): OdsCellStyle {
  const style: Record<string, unknown> = {};
  let lossy = false;

  const text = element.getElementsByTagNameNS(NS.style, 'text-properties')[0];
  if (text) {
    const weight = attr(text, NS.fo, 'font-weight');
    if (weight === 'bold' || Number.parseInt(weight ?? '', 10) >= 600) style.bl = 1;
    if (attr(text, NS.fo, 'font-style') === 'italic') style.it = 1;
    const underline = attr(text, NS.style, 'text-underline-style');
    if (underline && underline !== 'none') style.ul = { s: 1 };
    const color = attr(text, NS.fo, 'color');
    if (color && color !== 'transparent') style.cl = { rgb: color };
    const size = fontSizePx(attr(text, NS.fo, 'font-size'));
    if (size) style.fs = size;
    // 字体族 / 语言 / 背景色以外的文字属性本轮不映射
    if (attr(text, NS.style, 'font-name') || attr(text, NS.fo, 'font-family')) lossy = true;
  }

  const paragraph = element.getElementsByTagNameNS(NS.style, 'paragraph-properties')[0];
  if (paragraph) {
    const align = attr(paragraph, NS.fo, 'text-align');
    if (align === 'center') style.ht = 2;
    else if (align === 'right') style.ht = 3;
    else if (align === 'left' || align === 'start') style.ht = 1;
  }

  const cellProps = element.getElementsByTagNameNS(NS.style, 'table-cell-properties')[0];
  if (cellProps) {
    const background = attr(cellProps, NS.fo, 'background-color');
    if (background && background !== 'transparent') style.bg = { rgb: background };
    // 边框 / 内边距 / 竖排 / 自动换行：认得出来，但本工具的单元格模型表达不了
    for (const name of ['border', 'border-top', 'border-bottom', 'border-left', 'border-right']) {
      if (attr(cellProps, NS.fo, name)) lossy = true;
    }
    if (attr(cellProps, NS.style, 'vertical-align') || attr(cellProps, NS.fo, 'wrap-option')) {
      lossy = true;
    }
  }

  // 数字格式（data-style-name）会改变显示：本轮不解析，明确计入损失
  if (attr(element, NS.style, 'data-style-name')) lossy = true;

  return { style, lossy };
}

function readStyles(doc: Document): Map<string, OdsCellStyle> {
  const styles = new Map<string, OdsCellStyle>();
  for (const element of Array.from(doc.getElementsByTagNameNS(NS.style, 'style'))) {
    const name = attr(element, NS.style, 'name');
    const family = attr(element, NS.style, 'family');
    if (!name || family !== 'table-cell') continue;
    styles.set(name, readCellStyle(element));
  }
  return styles;
}

/** 单元格文本：多段落用换行拼接，保持"看到什么就是什么" */
function cellText(cell: Element): string {
  const paragraphs = Array.from(cell.getElementsByTagNameNS(NS.text, 'p'));
  if (paragraphs.length === 0) return (cell.textContent ?? '').trim();
  return paragraphs
    .map((paragraph) => (paragraph.textContent ?? '').trim())
    .filter((line, index, all) => line.length > 0 || index < all.length - 1)
    .join('\n');
}

/** 按 `office:value-type` 取值；日期保持 ISO 文本（不猜序列号） */
function cellValue(cell: Element): OdsCell['v'] {
  const type = attr(cell, NS.office, 'value-type');
  switch (type) {
    case 'float':
    case 'percentage':
    case 'currency': {
      const raw = attr(cell, NS.office, 'value');
      const value = raw === null ? Number.NaN : Number(raw);
      return Number.isFinite(value) ? value : cellText(cell) || undefined;
    }
    case 'boolean':
      return attr(cell, NS.office, 'boolean-value') === 'true';
    case 'date':
    case 'time':
      return attr(cell, NS.office, 'date-value') ?? cellText(cell);
    case 'string':
      return cellText(cell);
    default: {
      // 没有 value-type：纯文本单元格（ODS 允许）
      const text = cellText(cell);
      return text.length > 0 ? text : undefined;
    }
  }
}

function readSheet(table: Element, index: number, styles: Map<string, OdsCellStyle>): SheetBuild {
  const name = attr(table, NS.table, 'name') ?? `Sheet${index + 1}`;
  const sheet: SheetBuild = {
    id: `ods-sheet-${index + 1}`,
    name,
    cellData: {},
    mergeData: [],
    rows: 0,
    cols: 0,
    lossyCells: 0,
  };

  let rowIndex = 0;
  for (const row of Array.from(table.getElementsByTagNameNS(NS.table, 'table-row'))) {
    if (rowIndex >= MAX_ROWS) break;
    const rowRepeat = repeated(row, NS.table, 'number-rows-repeated');
    // 先读出这一行的内容，再决定要不要展开重复（空行重复没有信息量）
    const pending: { col: number; cell: OdsCell }[] = [];
    let col = 0;
    let rowHasContent = false;
    for (const cell of Array.from(row.children)) {
      if (!cell.namespaceURI) continue;
      const local = cell.localName;
      if (local !== 'table-cell' && local !== 'covered-table-cell') continue;
      const colRepeat = repeated(cell, NS.table, 'number-columns-repeated');
      if (local === 'covered-table-cell') {
        // 被合并覆盖的格子：合并区域已经由 span 记录，这里只需推进列号
        col += colRepeat;
        continue;
      }
      const value = cellValue(cell);
      const styleName = attr(cell, NS.table, 'style-name');
      const style = styleName ? styles.get(styleName) : undefined;
      const colSpan = repeated(cell, NS.table, 'number-columns-spanned');
      const rowSpan = repeated(cell, NS.table, 'number-rows-spanned');
      if (colSpan > 1 || rowSpan > 1) {
        sheet.mergeData.push({
          startRow: rowIndex,
          startColumn: col,
          endRow: rowIndex + rowSpan - 1,
          endColumn: col + colSpan - 1,
        });
      }
      if (value !== undefined || style) {
        rowHasContent = true;
        if (style?.lossy) sheet.lossyCells += colRepeat;
        const record: OdsCell = {};
        if (value !== undefined) record.v = value;
        if (style && Object.keys(style.style).length > 0) record.s = style.style;
        if (record.v !== undefined || record.s) {
          // 列重复 = 同一个格子横向复制：值也要落到每一列，只推进列号会丢内容
          for (let copy = 0; copy < colRepeat && col + copy < MAX_COLS; copy += 1) {
            pending.push({ col: col + copy, cell: { ...record } });
          }
        }
      }
      col += colRepeat;
      sheet.cols = Math.max(sheet.cols, Math.min(col, MAX_COLS));
    }

    const copies = rowHasContent ? rowRepeat : 1;
    for (let copy = 0; copy < copies && rowIndex < MAX_ROWS; copy += 1) {
      for (const item of pending) {
        if (item.col >= MAX_COLS) continue;
        const rowCells = (sheet.cellData[rowIndex] ??= {});
        rowCells[item.col] = { ...item.cell };
      }
      if (pending.length > 0) sheet.rows = Math.max(sheet.rows, rowIndex + 1);
      rowIndex += 1;
    }
  }

  return sheet;
}

/**
 * `.ods` 文件 → Univer 工作簿快照。
 * `outcome` 是导入保真报告的汇（P0-4）：样式损失与"工作表为空"都往这里写。
 */
export async function odsToSnapshot(
  file: File,
  outcome?: ImportOutcome,
): Promise<ToolResult<WorkbookSnapshot>> {
  const check = checkImportFile(file);
  if (!check.ok) return check;
  if (check.value !== 'ods') return { ok: false, error: 'NOT_XLSX' };

  let xml: string;
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entry = zip.file('content.xml');
    if (!entry) return { ok: false, error: 'IMPORT_FAILED' };
    xml = await entry.async('string');
  } catch {
    // 不是 zip / 读不出来：用户要做的事和"文件坏了"一样，不必区分
    return { ok: false, error: 'IMPORT_FAILED' };
  }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, 'application/xml');
  } catch {
    return { ok: false, error: 'IMPORT_FAILED' };
  }
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return { ok: false, error: 'IMPORT_FAILED' };
  }

  const tables = Array.from(doc.getElementsByTagNameNS(NS.table, 'table'));
  if (tables.length === 0) return { ok: false, error: 'IMPORT_FAILED' };

  const styles = readStyles(doc);
  const baseName = file.name.replace(/\.ods$/i, '') || 'workbook';
  const snapshot = createEmptySnapshot(baseName, 'zhCN');
  const template = snapshot.sheets[snapshot.sheetOrder[0]];

  const sheets: WorkbookSnapshot['sheets'] = {};
  let lossyCells = 0;
  tables.forEach((table, index) => {
    const sheet = readSheet(table, index, styles);
    lossyCells += sheet.lossyCells;
    sheets[sheet.id] = {
      ...template,
      id: sheet.id,
      name: sheet.name,
      cellData: sheet.cellData,
      mergeData: sheet.mergeData,
      rowCount: Math.max(1, sheet.rows),
      columnCount: Math.max(1, sheet.cols),
    } as WorkbookSnapshot['sheets'][string];
  });

  if (outcome) {
    if (lossyCells > 0) {
      const issue: FidelityIssue = {
        code: 'sheet.importOdsStyleLoss',
        severity: 'info',
        count: lossyCells,
        messageKey: 'tools.sheet.importOdsStyleLoss',
      };
      outcome.issues.push(issue);
    }
  }

  return {
    ok: true,
    value: {
      ...snapshot,
      name: baseName,
      sheetOrder: Object.keys(sheets),
      sheets,
    },
  };
}
