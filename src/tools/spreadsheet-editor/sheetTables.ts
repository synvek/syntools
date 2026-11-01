import { columnIndexToName } from './core';
import {
  addContentTypeEntries,
  contentTypeOverride,
  upsertRelationship,
  xmlEscape,
} from './chartXml';
import { parseRelationships, relsPathFor, resolveSheetParts } from './rawChartParts';
import type { WorkbookSnapshot } from './xlsx-io';

/**
 * 表格对象 / ListObject（P2-S7.3）：`xl/tables/tableN.xml` 双向。
 *
 * 为什么不直接用 exceljs 的 `worksheet.addTable()`：它的 `Table.store()` 会**把表头名和数据行写回单元格**
 * （`doc/table.js:186-232`），只保留 `cell.value`，公式缓存值、数字格式、边框、合并全部被抹掉。
 * 表格是"给已有区域套一层语义"，不该改写区域里的内容 —— 所以这里只写 part 与关系，
 * 不碰 `sheetData` 一个字节（与 `pivotXlsx.ts` / `chartXml.ts` 同一条 zip 后处理范式）。
 *
 * 读取侧反而简单：exceljs 解析 `xl/tables/*.xml` 并把结果挂在 `worksheet.tables` 上（不改写单元格，
 * 已实测），直接用它的模型即可。
 */

/** 0 基、闭区间的表格区域 */
export interface SheetTableRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

/** One table object as carried by the snapshot */
export interface SheetTable {
  id: string;
  /** 工作簿内唯一（Excel 要求 table 名不能与名称管理器里的名字重名） */
  name: string;
  sheetId: string;
  range: SheetTableRange;
  /** 列名（表头行文字），顺序与区域列一致 */
  columns: string[];
  headerRow: boolean;
  totalsRow: boolean;
  style: { name: string; showRowStripes: boolean };
}

const DEFAULT_STYLE = 'TableStyleMedium2';
const TABLE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/table';
const TABLE_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml';

/** `A1:C10` → 0 基闭区间；非法返回 null */
export function parseTableRef(text: string): SheetTableRange | null {
  const match = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})(?::\$?([A-Za-z]{1,3})\$?(\d{1,7}))?$/.exec(
    text.trim(),
  );
  if (!match) return null;
  const startColumn = colToIndex(match[1]);
  const startRow = Number(match[2]) - 1;
  const endColumn = match[3] ? colToIndex(match[3]) : startColumn;
  const endRow = match[4] ? Number(match[4]) - 1 : startRow;
  if (startRow < 0 || startColumn < 0) return null;
  return {
    startRow: Math.min(startRow, endRow),
    startColumn: Math.min(startColumn, endColumn),
    endRow: Math.max(startRow, endRow),
    endColumn: Math.max(startColumn, endColumn),
  };
}

/** 区域 → `A1:C10`（导出写 `ref` / `autoFilter` 用） */
export function tableRefOf(range: SheetTableRange): string {
  const from = `${columnIndexToName(range.startColumn)}${range.startRow + 1}`;
  const to = `${columnIndexToName(range.endColumn)}${range.endRow + 1}`;
  return `${from}:${to}`;
}

function colToIndex(column: string): number {
  let index = 0;
  for (const char of column.toUpperCase()) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

/** 区域的宽度（列数）——表格列定义必须与之一致，否则 Excel 会说文件需要修复 */
export function tableWidth(range: SheetTableRange): number {
  return range.endColumn - range.startColumn + 1;
}

/**
 * 生成不冲突的表名：`Table1`、`Table2`…（语言中立，避免结构化引用里出现需要引号的名字）。
 * 判重同时覆盖表格名与名称管理器里的名称 —— Excel 把两者放在同一个命名空间。
 */
export function uniqueTableName(taken: readonly string[], base = 'Table'): string {
  const used = new Set(taken.map((name) => name.toLowerCase()));
  for (let index = 1; index < 10000; index += 1) {
    const candidate = `${base}${index}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  return `${base}${Date.now().toString(36)}`;
}

/** exceljs 读出来的表格模型（只声明用到的字段） */
interface ExcelTableModel {
  name?: string;
  displayName?: string;
  tableRef?: string;
  headerRow?: boolean;
  totalsRow?: boolean;
  columns?: { name?: string }[];
  style?: { theme?: string; showRowStripes?: boolean };
}

/** 从 exceljs worksheet 读表格；`sheetId` 由调用方提供（exceljs 不认识我们的 id） */
export function readSheetTables(worksheet: { tables?: unknown }, sheetId: string): SheetTable[] {
  const source = worksheet.tables as
    Record<string, { table?: ExcelTableModel }> | ExcelTableModel[] | undefined;
  if (!source) return [];
  const models: ExcelTableModel[] = Array.isArray(source)
    ? source
    : Object.values(source).map((entry) => entry.table ?? (entry as ExcelTableModel));

  const out: SheetTable[] = [];
  models.forEach((model, index) => {
    const range = parseTableRef(model.tableRef ?? '');
    const name = model.displayName ?? model.name;
    if (!range || !name) return;
    const columns = (model.columns ?? []).map((column) => column.name ?? '');
    out.push({
      id: `table-${sheetId}-${index + 1}`,
      name,
      sheetId,
      range,
      // 列定义数量与区域宽度不一致时补齐/截断，保证写出后仍是合法表格
      columns: fitColumns(columns, tableWidth(range)),
      headerRow: model.headerRow !== false,
      totalsRow: model.totalsRow === true,
      style: {
        name: model.style?.theme ?? DEFAULT_STYLE,
        showRowStripes: model.style?.showRowStripes === true,
      },
    });
  });
  return out;
}

function fitColumns(columns: string[], width: number): string[] {
  const out = columns.slice(0, width);
  while (out.length < width) out.push(`Column${out.length + 1}`);
  return out;
}

/**
 * 用选区 + 表头文字建一张表。
 *
 * 表头行为空（或重复）时用 `Column1..n` 兜底：Excel 要求列名唯一，重名会让整张表打不开。
 * 少于两行（只有表头、没有数据）时返回 null —— 空表在 Excel 里点"确定"也会报错。
 */
export function createTableFromSelection(
  snapshot: WorkbookSnapshot,
  sheetId: string,
  range: SheetTableRange,
  taken: readonly string[],
): SheetTable | null {
  if (range.endRow <= range.startRow) return null;
  const width = tableWidth(range);
  if (width < 1) return null;
  const sheet = snapshot.sheets[sheetId];
  if (!sheet) return null;

  const label = (column: number): string => {
    const row = sheet.cellData?.[String(range.startRow)];
    const value = row?.[String(column)]?.v;
    const text = value === null || value === undefined ? '' : String(value).trim();
    return text;
  };

  const seen = new Set<string>();
  const columns: string[] = [];
  for (let offset = 0; offset < width; offset += 1) {
    let name = label(range.startColumn + offset) || `Column${offset + 1}`;
    let suffix = 2;
    while (seen.has(name.toLowerCase())) {
      name = `${name}${suffix}`;
      suffix += 1;
    }
    seen.add(name.toLowerCase());
    columns.push(name);
  }

  return {
    id: `table-${Date.now().toString(36)}-${Math.round(Math.random() * 1e4)}`,
    name: uniqueTableName(taken),
    sheetId,
    range,
    columns,
    headerRow: true,
    totalsRow: false,
    style: { name: DEFAULT_STYLE, showRowStripes: true },
  };
}

/** 与给定区域相交的表格（删除/替换时定位用） */
export function tablesInRange(
  tables: readonly SheetTable[],
  sheetId: string,
  range: SheetTableRange,
): SheetTable[] {
  return tables.filter(
    (table) =>
      table.sheetId === sheetId &&
      table.range.startRow <= range.endRow &&
      table.range.endRow >= range.startRow &&
      table.range.startColumn <= range.endColumn &&
      table.range.endColumn >= range.startColumn,
  );
}

/** 表名/列名都可能是中文，属性值统一转义 */
export function buildTableXml(table: SheetTable, id: number): string {
  const ref = tableRefOf(table.range);
  const columns = fitColumns(table.columns, tableWidth(table.range));
  const columnXml = columns
    .map((name, index) => `<tableColumn id="${index + 1}" name="${xmlEscape(name)}"/>`)
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
    ` id="${id}" name="${xmlEscape(table.name)}" displayName="${xmlEscape(table.name)}"` +
    ` ref="${ref}" headerRowCount="${table.headerRow ? 1 : 0}"` +
    (table.totalsRow ? ' totalsRowCount="1" totalsRowShown="1"' : '') +
    '>' +
    // 不带 filterColumn 子节点 = 每列默认显示筛选按钮（Excel 自己也是这个行为）
    `<autoFilter ref="${ref}"/>` +
    `<tableColumns count="${columns.length}">${columnXml}</tableColumns>` +
    '<tableStyleInfo' +
    ` name="${xmlEscape(table.style.name)}" showFirstColumn="0" showLastColumn="0"` +
    ` showRowStripes="${table.style.showRowStripes ? 1 : 0}" showColumnStripes="0"/>` +
    '</table>'
  );
}

/* ---------------------------------- zip 注入 ---------------------------------- */

async function readText(
  zip: Awaited<ReturnType<typeof loadZip>>,
  path: string,
): Promise<string | null> {
  const file = zip.file(path);
  return file ? file.async('string') : null;
}

async function loadZip(bytes: ArrayBuffer | Uint8Array) {
  const JSZip = (await import('jszip')).default;
  return JSZip.loadAsync(bytes);
}

/** 在 `</worksheet>` 前插入 `tableParts`（先清掉旧块，重写才幂等） */
export function setTablePartsInSheetXml(sheetXml: string, relIds: readonly string[]): string {
  const without = sheetXml.replace(/<tableParts\b[^>]*>[\s\S]*?<\/tableParts>/, '');
  if (relIds.length === 0) return without;
  const block =
    `<tableParts count="${relIds.length}">` +
    relIds.map((id) => `<tablePart r:id="${id}"/>`).join('') +
    '</tableParts>';
  const close = without.lastIndexOf('</worksheet>');
  return close < 0 ? without + block : `${without.slice(0, close)}${block}${without.slice(close)}`;
}

/**
 * 把快照里的表格写成原生 part 并注入 .xlsx。
 *
 * 每个 part 需要三处登记，缺一处 Excel 就报"内容有问题"：
 * `xl/tables/tableN.xml` 本体、sheet 关系（`tableParts` 的 `r:id` 指向它）、`[Content_Types].xml` 的 Override。
 */
export async function injectTablesIntoXlsx(
  bytes: ArrayBuffer | Uint8Array,
  snapshot: WorkbookSnapshot,
): Promise<ArrayBuffer> {
  const tables = snapshot.syntoolsTables ?? [];
  const zip = await loadZip(bytes);
  const sheetParts = await resolveSheetParts(zip);
  const sheetPathById = new Map<string, string>();
  for (const [name, path] of Object.entries(sheetParts)) {
    const id = Object.keys(snapshot.sheets).find((key) => snapshot.sheets[key]?.name === name);
    if (id) sheetPathById.set(id, path);
  }

  const contentTypes: string[] = [];
  let serial = 0;
  let touched = false;

  for (const [sheetId, sheetPath] of sheetPathById) {
    const own = tables.filter((table) => table.sheetId === sheetId);
    if (own.length === 0) continue;
    const sheetXml = await readText(zip, sheetPath);
    if (!sheetXml) continue;
    const relsPath = relsPathFor(sheetPath);
    let relsXml = await readText(zip, relsPath);
    const relIds: string[] = [];

    for (const table of own) {
      serial += 1;
      const partPath = `xl/tables/table${serial}.xml`;
      zip.file(partPath, buildTableXml(table, serial));
      contentTypes.push(contentTypeOverride(`/${partPath}`, TABLE_CONTENT_TYPE));
      const rel = upsertRelationship(relsXml, TABLE_REL, `../tables/table${serial}.xml`);
      relsXml = rel.xml;
      relIds.push(rel.id);
    }

    zip.file(relsPath, relsXml ?? '');
    zip.file(sheetPath, setTablePartsInSheetXml(sheetXml, relIds));
    touched = true;
  }

  if (!touched) return bytes instanceof ArrayBuffer ? bytes : (bytes.buffer as ArrayBuffer);

  const ct = await readText(zip, '[Content_Types].xml');
  if (ct) zip.file('[Content_Types].xml', addContentTypeEntries(ct, contentTypes));
  return (await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })) as ArrayBuffer;
}

/** 表名与名称管理器共享命名空间：新建时要一起判重 */
export function takenNames(snapshot: WorkbookSnapshot): string[] {
  return [
    ...(snapshot.syntoolsTables ?? []).map((table) => table.name),
    ...(snapshot.namedRanges ?? []).map((name) => name.name),
  ];
}

/** 导出前的清洗：丢掉区域非法的表，保证每个 part 都能被 Excel 打开 */
export function sanitizeTables(tables: readonly SheetTable[]): SheetTable[] {
  return tables.filter(
    (table) =>
      table.sheetId &&
      table.name &&
      table.range.endRow >= table.range.startRow &&
      table.range.endColumn >= table.range.startColumn &&
      table.columns.length > 0,
  );
}

/** 只读校验用：解析 relationships 便于测试断言 */
export function tableRelationshipCount(relsXml: string | null): number {
  return parseRelationships(relsXml).filter((item) => item.type === TABLE_REL).length;
}
