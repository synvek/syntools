import { columnIndexToName, dateToExcelSerial } from './core';
import {
  addContentTypeEntries,
  contentTypeOverride,
  ensureRelationshipNamespace,
  upsertRelationship,
  xmlEscape,
} from './chartXml';
import {
  collectFieldKeys,
  computePivot,
  pivotToMatrix,
  readPivotSource,
  type PivotConfig,
  type PivotKey,
  type PivotRange,
  type PivotResult,
  type PivotSource,
} from './pivot';
import { relsPathFor, resolveSheetParts } from './rawChartParts';
import type { WorkbookSnapshot } from './xlsx-io';

/**
 * 原生可刷新透视表：把面板里的配置写成真正的 `pivotTable` + `pivotCacheDefinition` +
 * `pivotCacheRecords` part，注入到 exceljs 产出的 .xlsx 里（同 `chartXml.ts` 的 zip 后处理范式）。
 *
 * 为什么值得做：exceljs 4.4 写不出 `pivotTable` part，之前只能导出"值快照"——数字对，但在 Excel
 * 里不能改字段、不能刷新。写入原生 part 之后，用户拿到的是能继续拖字段的表；静态值仍保留在单元格里，
 * 作为"刷新前"的缓存画面。
 *
 * 注入点（缺一个 Excel 就会提示修复）：
 * 1. `xl/pivotTables/pivotTableN.xml` + `.rels` → 缓存定义
 * 2. `xl/pivotCache/pivotCacheDefinitionN.xml` + `.rels` → 缓存记录
 * 3. `xl/pivotCache/pivotCacheRecordsN.xml`
 * 4. `xl/worksheets/_rels/sheetK.xml.rels` → 透视表 part（工作表与透视表的关联只走 rels）
 * 5. `xl/_rels/workbook.xml.rels` + `xl/workbook.xml` 的 `<pivotCaches>`
 * 6. `[Content_Types].xml` → 三个 part 的 Override
 *
 * 布局口径：与 `pivotToMatrix` 完全一致（首行是列键、首列是行键、合计行列在末尾），
 * 并把 `location` 指向同一块区域，这样"打开时看到的"和"刷新后重算的"落在同一处。
 */

const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

const REL_PIVOT_TABLE = `${R_NS}/pivotTable`;
const REL_PIVOT_CACHE_DEFINITION = `${R_NS}/pivotCacheDefinition`;
const REL_PIVOT_CACHE_RECORDS = `${R_NS}/pivotCacheRecords`;

const CT_PIVOT_TABLE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.pivotTable+xml';
const CT_PIVOT_CACHE_DEFINITION =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.pivotCacheDefinition+xml';
const CT_PIVOT_CACHE_RECORDS =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.pivotCacheRecords+xml';

/** 缓存里一个源列的形态：决定 `sharedItems` 与记录的写法 */
export type NativePivotFieldKind = 'text' | 'number' | 'boolean';

export interface NativePivotField {
  /** 表头文本（缺表头时是列字母） */
  name: string;
  kind: NativePivotFieldKind;
  /** 按 `compareKeys` 排好序的键；下标即 `<x v="…">` 的取值 */
  items: PivotKey[];
  min: number | null;
  max: number | null;
  /** 数字列里全是整数：写 `containsInteger` 让 Excel 用整数格式 */
  integer: boolean;
}

export interface PivotXlsxItem {
  /** 透视结果所在工作表名 */
  sheetName: string;
  /** 源工作表名（缓存 `worksheetSource@sheet`） */
  sourceSheetName: string;
  /** 源区域 A1 记法（不含工作表名） */
  sourceRef: string;
  /** 透视表锚定区域 A1 记法 */
  locationRef: string;
  config: PivotConfig;
  source: PivotSource;
  result: PivotResult;
  fields: NativePivotField[];
}

export interface PivotXlsxPlan {
  items: PivotXlsxItem[];
}

/* ------------------------------------- 计划 ------------------------------------- */

/**
 * 哪些配置能以原生透视表导出。
 *
 * 只放行"静态预览和 Excel 布局能对上"的形态：
 * - 多级**列**字段：Excel 每个列字段占一行表头，静态矩阵只有一行（把标签用 " / " 拼起来），
 *   两者对不上，刷新后表会整体下移、盖住合计行；
 * - 有筛选：原生 part 的筛选是页字段（pivotField axis="axisPage"），会把表整体推下去；
 *   而把筛选写进缓存又等于"刷新后换了口径"，两种都不诚实 —— 退回静态值并告警；
 * - 截断（超 5 万单元格）：缓存里只有部分行，刷新后数字会变。
 */
export function canInjectNativePivot(config: PivotConfig, source: PivotSource): boolean {
  if (source.truncated) return false;
  if (source.fields.length === 0 || source.records.length === 0) return false;
  if (config.cols.length > 1) return false;
  if (Object.keys(config.filters).length > 0) return false;
  if (config.values.length === 0) return false;
  return true;
}

function minMax(range: PivotRange) {
  return {
    startRow: Math.min(range.startRow, range.endRow),
    endRow: Math.max(range.startRow, range.endRow),
    startColumn: Math.min(range.startColumn, range.endColumn),
    endColumn: Math.max(range.startColumn, range.endColumn),
  };
}

/** 区域 → A1 记法（0-based 闭区间；工作表名由调用方补） */
export function pivotRangeRef(range: PivotRange): string {
  const { startRow, endRow, startColumn, endColumn } = minMax(range);
  const start = `${columnIndexToName(startColumn)}${startRow + 1}`;
  const end = `${columnIndexToName(endColumn)}${endRow + 1}`;
  return start === end ? start : `${start}:${end}`;
}

function fieldKind(source: PivotSource, column: number): NativePivotFieldKind {
  let sawNumber = false;
  let sawBoolean = false;
  let sawText = false;
  for (const record of source.records) {
    const value = record.values[column];
    if (value === null || value === undefined) continue;
    if (typeof value === 'boolean') sawBoolean = true;
    else if (typeof value === 'number') sawNumber = true;
    else if (typeof value === 'string' && value.trim() !== '') sawText = true;
  }
  if (sawText) return 'text';
  if (sawBoolean) return 'boolean';
  if (sawNumber) return 'number';
  return 'text';
}

function buildField(source: PivotSource, column: number): NativePivotField {
  const items = collectFieldKeys(source, column);
  const kind = fieldKind(source, column);
  const numeric = items
    .filter((item) => item.numeric !== null)
    .map((item) => item.numeric as number);
  return {
    name: source.fields[column]?.label ?? columnIndexToName(column),
    kind,
    items,
    min: numeric.length > 0 ? Math.min(...numeric) : null,
    max: numeric.length > 0 ? Math.max(...numeric) : null,
    integer: numeric.length > 0 && numeric.every((value) => Number.isInteger(value)),
  };
}

/** 快照 → 注入计划（只包含"能刷新"的透视表；其余仍走静态值） */
export function buildPivotXlsxPlan(snapshot: WorkbookSnapshot): PivotXlsxPlan {
  const links = snapshot.syntoolsPivotSheets ?? [];
  if (links.length === 0) return { items: [] };
  const configs = new Map((snapshot.syntoolsPivots ?? []).map((config) => [config.id, config]));

  const items: PivotXlsxItem[] = [];
  for (const link of links) {
    const sheet = snapshot.sheets?.[link.sheetId];
    const config = configs.get(link.configId);
    if (!sheet || !config) continue;
    const source = readPivotSource(snapshot, config);
    if (!canInjectNativePivot(config, source)) continue;
    const result = computePivot(config, source);
    if (result.rowKeys.length === 0) continue;

    const matrix = pivotToMatrix(result, config, '');
    const rowCount = matrix.length;
    const colCount = matrix[0]?.length ?? 1;
    const locationRef = `A1:${columnIndexToName(colCount - 1)}${rowCount}`;
    const sourceSheetName = snapshot.sheets?.[config.sheetId]?.name ?? 'Sheet1';

    items.push({
      sheetName: sheet.name,
      sourceSheetName,
      sourceRef: pivotRangeRef(config.range),
      locationRef,
      config,
      source,
      result,
      fields: source.fields.map((_, column) => buildField(source, column)),
    });
  }
  return { items };
}

/* ----------------------------------- XML 构建 ----------------------------------- */

function boolAttr(value: boolean): string {
  return value ? '1' : '0';
}

function numberText(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return String(value);
}

function sharedItemsXml(field: NativePivotField): string {
  if (field.kind === 'number') {
    if (field.items.length === 0) return '<sharedItems/>';
    const min = field.min === null ? '' : ` minValue="${numberText(field.min)}"`;
    const max = field.max === null ? '' : ` maxValue="${numberText(field.max)}"`;
    return (
      `<sharedItems containsSemiMixedTypes="0" containsString="0" containsNumber="1"` +
      `${field.integer ? ' containsInteger="1"' : ''}${min}${max}/>`
    );
  }
  if (field.kind === 'boolean') {
    return (
      '<sharedItems count="2" containsSemiMixedTypes="0" containsString="0" ' +
      'containsNumber="0" containsBoolean="1"><b v="1"/><b v="0"/></sharedItems>'
    );
  }
  if (field.items.length === 0) return '<sharedItems/>';
  const children = field.items
    .map((item) => (item.blank ? '<m/>' : `<s v="${xmlEscape(item.label)}"/>`))
    .join('');
  const blank = field.items.some((item) => item.blank) ? ' containsBlank="1"' : '';
  return `<sharedItems count="${field.items.length}"${blank}>${children}</sharedItems>`;
}

/** `pivotCacheDefinition`：源区域 + 每个源列的共享项；`refreshOnLoad` 让 Excel 打开即重算 */
export function buildPivotCacheDefinitionXml(item: PivotXlsxItem, recordCount: number): string {
  const cacheFields = item.fields
    .map(
      (field) =>
        `<cacheField name="${xmlEscape(field.name)}" numFmtId="0">${sharedItemsXml(field)}</cacheField>`,
    )
    .join('');
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<pivotCacheDefinition xmlns="${MAIN_NS}" xmlns:r="${R_NS}" r:id="rId1" ` +
    // refreshedDate 是 Excel 序列日期（数字），不是 ISO 字符串——写成 ISO 会被 Excel/openpyxl 判为非法
    `refreshOnLoad="1" refreshedBy="SynTools" refreshedDate="${dateToExcelSerial(new Date())}" ` +
    `createdVersion="6" refreshedVersion="6" minRefreshableVersion="3" ` +
    `saveData="1" recordCount="${recordCount}">` +
    `<cacheSource type="worksheet"><worksheetSource ref="${item.sourceRef}" ` +
    `sheet="${xmlEscape(item.sourceSheetName)}"/></cacheSource>` +
    `<cacheFields count="${item.fields.length}">${cacheFields}</cacheFields>` +
    `</pivotCacheDefinition>`
  );
}

/**
 * 一条缓存记录里的一个值。
 *
 * 文本写**共享项下标**（`<s v="1"/>` 指向该列 `sharedItems` 的第 1 项），不是文本本身——
 * 这是 pivotCacheRecords 与 cacheField 的唯一约定，写错会让 Excel 把整列当成数字列。
 */
function recordValueXml(value: unknown, key: PivotKey, field: NativePivotField): string {
  if (key.blank) return '<m/>';
  if (typeof value === 'boolean') return `<b v="${boolAttr(value)}"/>`;
  if (typeof value === 'number') return `<n v="${numberText(value)}"/>`;
  if (field.kind === 'number' && key.numeric !== null) return `<n v="${numberText(key.numeric)}"/>`;
  return `<s v="${itemIndex(field, key)}"/>`;
}

/** `pivotCacheRecords`：逐行写源区域的值（刷新前 Excel 直接用它算，不依赖网络） */
export function buildPivotCacheRecordsXml(item: PivotXlsxItem): string {
  const rows = item.source.records
    .map((record) => {
      const cells = item.fields
        .map((field, column) => recordValueXml(record.values[column], record.keys[column], field))
        .join('');
      return `<r>${cells}</r>`;
    })
    .join('');
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<pivotCacheRecords xmlns="${MAIN_NS}" xmlns:r="${R_NS}" count="${item.source.records.length}">` +
    `${rows}</pivotCacheRecords>`
  );
}

const AGGREGATION_NAMES: Record<string, string> = {
  sum: 'Sum',
  count: 'Count',
  avg: 'Average',
  min: 'Min',
  max: 'Max',
};

/** 键 → 该字段 `<x v>` 的取值（与 `sharedItems` 同序） */
function itemIndex(field: NativePivotField | undefined, key: PivotKey | undefined): number {
  if (!field || !key) return 0;
  const index = field.items.findIndex((item) => item.key === key.key);
  return index < 0 ? 0 : index;
}

function pivotFieldXml(
  field: NativePivotField,
  axis: 'axisRow' | 'axisCol' | 'data' | null,
): string {
  if (axis === 'data') return `<pivotField dataField="1" showAll="0"/>`;
  if (!axis) return `<pivotField showAll="0"/>`;
  const items =
    field.items.length === 0
      ? ''
      : `<items count="${field.items.length + 1}">${field.items
          .map((_, index) => `<item x="${index}"/>`)
          .join('')}<item t="default"/></items>`;
  return `<pivotField axis="${axis}" showAll="0">${items}</pivotField>`;
}

function rowItemsXml(item: PivotXlsxItem): string {
  const { result, fields } = item;
  const hasCols = result.colFields.length > 0;
  const rows = result.rowKeys
    .map((keys) => {
      const children = result.rowFields
        .map((column, level) => `<x v="${itemIndex(fields[column], keys[level])}"/>`)
        .join('');
      return `<i>${children}</i>`;
    })
    .join('');
  const grand = hasCols ? '<i t="grand"><x/></i>' : '';
  return `<rowItems count="${result.rowKeys.length + (hasCols ? 1 : 0)}">${rows}${grand}</rowItems>`;
}

function colItemsXml(item: PivotXlsxItem): string {
  const { result, fields } = item;
  const hasCols = result.colFields.length > 0;
  const valueCount = result.blocks.length || 1;

  if (!hasCols) {
    // 没有列字段：单值就是"值"伪列一项；多值每个数据字段一项
    if (valueCount === 1) return '<colItems count="1"><i/></colItems>';
    const entries = Array.from({ length: valueCount }, (_, index) =>
      index === 0 ? '<i/>' : `<i i="${index}"/>`,
    ).join('');
    return `<colItems count="${valueCount}">${entries}</colItems>`;
  }

  const column = result.colFields[0];
  const field = fields[column];
  const items: string[] = [];
  result.colKeys.forEach((keys) => {
    const x = itemIndex(field, keys[0]);
    if (valueCount === 1) {
      items.push(`<i><x v="${x}"/></i>`);
      return;
    }
    for (let index = 0; index < valueCount; index += 1) {
      items.push(index === 0 ? `<i><x v="${x}"/></i>` : `<i i="${index}"><x v="${x}"/></i>`);
    }
  });
  // 合计列：单值一项；多值按数据字段各一项
  if (valueCount === 1) {
    items.push('<i t="grand"><x/></i>');
  } else {
    for (let index = 0; index < valueCount; index += 1) {
      items.push(index === 0 ? '<i t="grand"><x/></i>' : `<i i="${index}" t="grand"><x/></i>`);
    }
  }
  return `<colItems count="${items.length}">${items.join('')}</colItems>`;
}

/** `pivotTableDefinition`：字段轴 / 行列表头项 / 值字段，位置指向静态矩阵 */
export function buildPivotTableDefinitionXml(
  item: PivotXlsxItem,
  cacheId: number,
  tableName: string,
): string {
  const { result } = item;
  const hasCols = result.colFields.length > 0;
  const valueCount = result.blocks.length || 1;
  const headerRows = valueCount > 1 ? 2 : 1;
  const firstDataCol = result.rowFields.length > 0 ? 1 : 0;
  const valueColumns = result.blocks.map((block) => block.valueField.column);

  const pivotFields = item.fields
    .map((field, column) => {
      if (result.rowFields.includes(column)) return pivotFieldXml(field, 'axisRow');
      if (result.colFields.includes(column)) return pivotFieldXml(field, 'axisCol');
      if (valueColumns.includes(column)) return pivotFieldXml(field, 'data');
      return pivotFieldXml(field, null);
    })
    .join('');

  const rowFields =
    result.rowFields.length > 0
      ? `<rowFields count="${result.rowFields.length}">${result.rowFields
          .map((column) => `<field x="${column}"/>`)
          .join('')}</rowFields>`
      : '';
  // 多值字段且没有列字段时，Excel 用 x="-2" 表示"值"轴
  const colFields = hasCols
    ? `<colFields count="${result.colFields.length}">${result.colFields
        .map((column) => `<field x="${column}"/>`)
        .join('')}</colFields>`
    : valueCount > 1
      ? '<colFields count="1"><field x="-2"/></colFields>'
      : '';

  const dataFields = `<dataFields count="${result.blocks.length}">${result.blocks
    .map((block) => {
      const aggregation = block.valueField.aggregation;
      const name = `${AGGREGATION_NAMES[aggregation] ?? 'Sum'} of ${block.label}`;
      return `<dataField name="${xmlEscape(name)}" fld="${block.valueField.column}" subtotal="${aggregation}" baseField="0" baseItem="0"/>`;
    })
    .join('')}</dataFields>`;

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<pivotTableDefinition xmlns="${MAIN_NS}" name="${xmlEscape(tableName)}" cacheId="${cacheId}" ` +
    `dataCaption="Values" updatedVersion="6" minRefreshableVersion="3" createdVersion="6" ` +
    `applyNumberFormats="0" applyBorderFormats="0" applyFontFormats="0" applyPatternFormats="0" ` +
    `applyAlignmentFormats="0" applyWidthHeightFormats="1" indent="0" outline="1" outlineData="1" ` +
    `multipleFieldFilters="0">` +
    `<location ref="${item.locationRef}" firstHeaderRow="1" firstDataRow="${headerRows}" ` +
    `firstDataCol="${firstDataCol}" rowPageCount="0" colPageCount="0"/>` +
    `<pivotFields count="${item.fields.length}">${pivotFields}</pivotFields>` +
    rowFields +
    rowItemsXml(item) +
    colFields +
    colItemsXml(item) +
    dataFields +
    `<pivotTableStyleInfo name="PivotStyleLight16" showRowHeaders="1" showColHeaders="1" ` +
    `showRowStripes="0" showColStripes="0" showLastColumn="1"/>` +
    `</pivotTableDefinition>`
  );
}

/* ---------------------------------- workbook 合并 ---------------------------------- */

/** 把新的 `<pivotCache>` 合并进 workbook.xml 的 `<pivotCaches>`（没有就新建） */
export function insertPivotCachesIntoWorkbook(
  workbookXml: string,
  entries: readonly { cacheId: number; relId: string }[],
): string {
  if (entries.length === 0) return workbookXml;
  const withNamespace = ensureRelationshipNamespace(workbookXml);
  const tags = entries
    .map((entry) => `<pivotCache cacheId="${entry.cacheId}" r:id="${entry.relId}"/>`)
    .join('');

  const openIndex = withNamespace.indexOf('<pivotCaches');
  if (openIndex >= 0) {
    const closeIndex = withNamespace.indexOf('</pivotCaches>', openIndex);
    if (closeIndex >= 0) {
      const block = withNamespace.slice(openIndex, closeIndex);
      const existing = block.match(/<pivotCache\b[^>]*\/>/g) ?? [];
      const count = existing.length + entries.length;
      const rebuilt = `<pivotCaches count="${count}">${existing.join('')}${tags}</pivotCaches>`;
      return withNamespace.slice(0, openIndex) + rebuilt + withNamespace.slice(closeIndex + 15);
    }
  }

  // CT_Workbook 顺序：… definedNames → calcPr → pivotCaches → … → extLst
  const block = `<pivotCaches count="${entries.length}">${tags}</pivotCaches>`;
  const extIndex = withNamespace.indexOf('<extLst');
  if (extIndex >= 0) {
    return `${withNamespace.slice(0, extIndex)}${block}${withNamespace.slice(extIndex)}`;
  }
  const close = withNamespace.lastIndexOf('</workbook>');
  return close < 0
    ? withNamespace
    : `${withNamespace.slice(0, close)}${block}${withNamespace.slice(close)}`;
}

function relsXml(relationships: readonly { id: string; type: string; target: string }[]): string {
  const body = relationships
    .map(
      (relationship) =>
        `<Relationship Id="${relationship.id}" Type="${relationship.type}" Target="${relationship.target}"/>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${PKG_REL_NS}">${body}</Relationships>`;
}

/* ----------------------------------- zip 注入 ----------------------------------- */

function maxSuffix(paths: readonly string[], pattern: RegExp): number {
  let max = 0;
  for (const path of paths) {
    const matched = pattern.exec(path);
    if (matched) max = Math.max(max, Number(matched[1]));
  }
  return max;
}

async function readText(
  zip: { file: (path: string) => { async: (type: 'string') => Promise<string> } | null },
  path: string,
): Promise<string | null> {
  const file = zip.file(path);
  return file ? file.async('string') : null;
}

/**
 * 注入原生透视表 part。
 *
 * 计划为空时原样返回；任何一张工作表找不到对应 part 就跳过它（不让半个 part 让整本工作簿打不开）。
 */
export async function injectPivotTablesIntoXlsx(
  buffer: ArrayBuffer,
  plan: PivotXlsxPlan,
): Promise<ArrayBuffer> {
  if (plan.items.length === 0) return buffer;
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  const sheetParts = await resolveSheetParts(zip);
  const paths = Object.keys(zip.files);

  let tableSeq = maxSuffix(paths, /^xl\/pivotTables\/pivotTable(\d+)\.xml$/);
  let cacheSeq = maxSuffix(paths, /^xl\/pivotCache\/pivotCacheDefinition(\d+)\.xml$/);
  let workbookRels = await readText(zip, 'xl/_rels/workbook.xml.rels');
  const workbookXml = await readText(zip, 'xl/workbook.xml');
  if (workbookXml === null) return buffer;

  let cacheId = (workbookXml.match(/<pivotCache\b[^>]*\bcacheId="(\d+)"/g) ?? []).reduce(
    (max, tag) => Math.max(max, Number(/\bcacheId="(\d+)"/.exec(tag)?.[1] ?? 0)),
    0,
  );

  const contentTypeEntries: string[] = [];
  const cacheEntries: { cacheId: number; relId: string }[] = [];

  for (const item of plan.items) {
    const sheetPath = sheetParts[item.sheetName];
    if (!sheetPath) continue;

    tableSeq += 1;
    cacheSeq += 1;
    cacheId += 1;

    const tablePath = `xl/pivotTables/pivotTable${tableSeq}.xml`;
    const cachePath = `xl/pivotCache/pivotCacheDefinition${cacheSeq}.xml`;
    const recordsPath = `xl/pivotCache/pivotCacheRecords${cacheSeq}.xml`;

    zip.file(tablePath, buildPivotTableDefinitionXml(item, cacheId, `PivotTable${tableSeq}`));
    zip.file(cachePath, buildPivotCacheDefinitionXml(item, item.source.records.length));
    zip.file(recordsPath, buildPivotCacheRecordsXml(item));

    // 透视表 → 缓存定义（相对 pivotTables/ 的路径）
    zip.file(
      relsPathFor(tablePath),
      relsXml([
        {
          id: 'rId1',
          type: REL_PIVOT_CACHE_DEFINITION,
          target: `../pivotCache/pivotCacheDefinition${cacheSeq}.xml`,
        },
      ]),
    );
    // 缓存定义 → 缓存记录（同目录，相对路径）
    zip.file(
      relsPathFor(cachePath),
      relsXml([
        {
          id: 'rId1',
          type: REL_PIVOT_CACHE_RECORDS,
          target: `pivotCacheRecords${cacheSeq}.xml`,
        },
      ]),
    );

    // 工作表 → 透视表（工作簿里唯一的关联方向）
    const sheetRelsPath = relsPathFor(sheetPath);
    const sheetRels = await readText(zip, sheetRelsPath);
    const tableRel = upsertRelationship(
      sheetRels,
      REL_PIVOT_TABLE,
      `../pivotTables/pivotTable${tableSeq}.xml`,
    );
    zip.file(sheetRelsPath, tableRel.xml);

    // workbook → 缓存定义 + <pivotCaches>
    const cacheRel = upsertRelationship(
      workbookRels,
      REL_PIVOT_CACHE_DEFINITION,
      `pivotCache/pivotCacheDefinition${cacheSeq}.xml`,
    );
    workbookRels = cacheRel.xml;
    cacheEntries.push({ cacheId, relId: cacheRel.id });

    contentTypeEntries.push(
      contentTypeOverride(`/${tablePath}`, CT_PIVOT_TABLE),
      contentTypeOverride(`/${cachePath}`, CT_PIVOT_CACHE_DEFINITION),
      contentTypeOverride(`/${recordsPath}`, CT_PIVOT_CACHE_RECORDS),
    );
  }

  if (cacheEntries.length === 0) return buffer;

  if (workbookRels) zip.file('xl/_rels/workbook.xml.rels', workbookRels);
  zip.file('xl/workbook.xml', insertPivotCachesIntoWorkbook(workbookXml, cacheEntries));

  const contentTypes = await readText(zip, '[Content_Types].xml');
  if (contentTypes) {
    zip.file('[Content_Types].xml', addContentTypeEntries(contentTypes, contentTypeEntries));
  }

  return (await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
  })) as ArrayBuffer;
}
