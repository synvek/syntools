import { columnIndexToName, excelSerialToDate } from './core';

/**
 * 透视表聚合内核（P2-4.2）。
 *
 * 纯函数、无 Univer、无 exceljs：输入是"值矩阵"（从快照里读出来的显示值），输出是交叉表。
 * 这样 5 组数据 × 5 种聚合可以完全脱离 UI 单测，也让"重算"变成一次纯计算（源表变更即重算）。
 *
 * 三个刻意的口径（照 Excel 透视表的行为，而不是"顺手"实现）：
 * 1. **键的规范化**：日期按 `YYYY-MM-DD`（用单元格的日期格式判定）、数字按数值、文本去首尾空白后再比。
 *    否则 `1` 与 `'1'`、`2026-01-01 08:00` 与 `2026-01-01` 会分成两组，看起来"没聚合"。
 * 2. **空值单独成组**：`(blank)` 是 Excel 的真实分组，不是"被过滤掉"；混进值字段时空值不计入计数。
 * 3. **值字段只吃数字**：sum/avg/min/max 遇到文本跳过并计数（`skippedValues`），不把 `'abc'` 当 0。
 *    `count` 是唯一计文本的聚合（Excel 的"计数"计非空）。
 */

export type PivotAggregation = 'sum' | 'count' | 'avg' | 'min' | 'max';

export const PIVOT_AGGREGATIONS: readonly PivotAggregation[] = [
  'sum',
  'count',
  'avg',
  'min',
  'max',
];

/** 源区域单元格预算：超过就只聚合前 N 行并置 `truncated`，绝不静默截断 */
export const PIVOT_SOURCE_LIMIT = 50_000;

/** 0-based 闭区间，与 `print.ts:CellRange` 同一口径 */
export interface PivotRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

export interface PivotValueField {
  /** 源区域内的列偏移（0 = 第一列） */
  column: number;
  aggregation: PivotAggregation;
}

export interface PivotConfig {
  id: string;
  name: string;
  sheetId: string;
  /** 源区域（含表头行，0-based 绝对坐标） */
  range: PivotRange;
  /** 行字段（列偏移，可多级） */
  rows: number[];
  cols: number[];
  values: PivotValueField[];
  /** 列偏移 -> 允许的键值集合；缺省表示不过滤 */
  filters: Record<number, string[]>;
  /** 首行是否为字段名 */
  hasHeader: boolean;
}

export interface PivotKey {
  /** 规范化后的键（比较用） */
  key: string;
  /** 展示文本（空值时为 ''，由 UI 显示 `(空白)`） */
  label: string;
  blank: boolean;
  /** 数值键的数值（排序用；非数值为 null） */
  numeric: number | null;
}

export interface PivotField {
  column: number;
  label: string;
}

export interface PivotRecord {
  rowIndex: number;
  /** 每个源列的规范化键（与 `fields` 对齐） */
  keys: PivotKey[];
  /** 每个源列的原始值（聚合用） */
  values: unknown[];
}

export interface PivotSource {
  fields: PivotField[];
  records: PivotRecord[];
  /** 源区域超出单元格预算，尾部行被丢弃 */
  truncated: boolean;
  /** 整行为空而被跳过的行数（Excel 也不把它们计入） */
  emptyRows: number;
}

export interface PivotResult {
  fields: PivotField[];
  rowFields: number[];
  colFields: number[];
  rowKeys: PivotKey[][];
  colKeys: PivotKey[][];
  /** cells[row][col]，null = 该组合没有可聚合的值 */
  cells: (number | null)[][];
  rowTotals: (number | null)[];
  colTotals: (number | null)[];
  grandTotal: number | null;
  /** 值字段遇到文本而跳过的单元格数 */
  skippedValues: number;
  truncated: boolean;
}

type CellLike = { v?: unknown; f?: unknown; s?: { n?: { pattern?: string } } };
type SheetLike = { cellData?: Record<string, Record<string, CellLike>> };
type WorkbookLike = { sheets?: Record<string, SheetLike | undefined> };

const BLANK_KEY = 'blank:';

/** 日期判定与 `print.ts` 的格式化口径一致：含年月日占位符且带分隔符 */
function isDatePattern(pattern: string | undefined): boolean {
  return !!pattern && /[ymd]/i.test(pattern) && /[-/]/.test(pattern);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 单元格值 -> 规范化键（聚合分组的唯一依据） */
export function normalizeKey(value: unknown, pattern?: string): PivotKey {
  if (value === null || value === undefined)
    return { key: BLANK_KEY, label: '', blank: true, numeric: null };
  if (typeof value === 'boolean') {
    const label = value ? 'TRUE' : 'FALSE';
    return { key: `b:${label}`, label, blank: false, numeric: value ? 1 : 0 };
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { key: BLANK_KEY, label: '', blank: true, numeric: null };
    if (isDatePattern(pattern)) {
      const date = excelSerialToDate(value);
      if (!Number.isNaN(date.getTime())) {
        // 时分秒不参与分组：Excel 的日期分组默认按天
        const label = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        return { key: `d:${label}`, label, blank: false, numeric: value };
      }
    }
    const label = String(value);
    return { key: `n:${label}`, label, blank: false, numeric: value };
  }
  const text = String(value).trim();
  if (!text) return { key: BLANK_KEY, label: '', blank: true, numeric: null };
  return { key: `t:${text}`, label: text, blank: false, numeric: null };
}

/** 数值取值：数字原样、布尔 1/0、数字字符串按数字；其余为 null（文本不当 0） */
export function pivotNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

/** 非空判定（count 用：文本也算） */
function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/**
 * 从快照的源区域读出字段与记录。
 *
 * 读的是 `v`（显示值前身）而不是公式：透视表要的是"你现在看到的数"，
 * 公式结果在 Univer 保存快照时已经算进了 `v`（与 `csv.ts:formatCsvValue` 同一口径）。
 */
export function readPivotSource(
  snapshot: WorkbookLike,
  config: PivotConfig,
  /** 单元格预算，测试用小值即可覆盖截断分支 */
  limit = PIVOT_SOURCE_LIMIT,
): PivotSource {
  const sheet = snapshot.sheets?.[config.sheetId];
  const empty: PivotSource = { fields: [], records: [], truncated: false, emptyRows: 0 };
  if (!sheet) return empty;

  const { startRow, startColumn, endRow, endColumn } = config.range;
  const firstRow = Math.min(startRow, endRow);
  const lastRow = Math.max(startRow, endRow);
  const firstCol = Math.min(startColumn, endColumn);
  const lastCol = Math.max(startColumn, endColumn);
  const width = lastCol - firstCol + 1;
  if (width <= 0) return empty;

  const bodyStart = config.hasHeader ? firstRow + 1 : firstRow;
  const budgetRows = Math.max(0, Math.floor(limit / width));
  const availableRows = lastRow - bodyStart + 1;
  const truncated = availableRows > budgetRows;
  const bodyEnd = truncated ? bodyStart + budgetRows - 1 : lastRow;

  const readRow = (row: number) => sheet.cellData?.[String(row)] ?? {};

  const fields: PivotField[] = [];
  for (let offset = 0; offset < width; offset += 1) {
    const column = firstCol + offset;
    const headerCell = config.hasHeader ? readRow(firstRow)[String(column)] : undefined;
    const headerText =
      headerCell?.v === undefined || headerCell?.v === null ? '' : String(headerCell.v).trim();
    fields.push({ column: offset, label: headerText || columnIndexToName(column) });
  }

  const records: PivotRecord[] = [];
  let emptyRows = 0;
  for (let row = bodyStart; row <= bodyEnd; row += 1) {
    const cells = readRow(row);
    const keys: PivotKey[] = [];
    const values: unknown[] = [];
    let anyPresent = false;
    for (let offset = 0; offset < width; offset += 1) {
      const cell = cells[String(firstCol + offset)];
      const value = cell?.v;
      if (isPresent(value)) anyPresent = true;
      keys.push(normalizeKey(value, cell?.s?.n?.pattern));
      values.push(value);
    }
    if (!anyPresent) {
      emptyRows += 1;
      continue;
    }
    records.push({ rowIndex: row, keys, values });
  }

  return { fields, records, truncated, emptyRows };
}

interface Accumulator {
  sum: number;
  count: number;
  min: number;
  max: number;
}

function addTo(acc: Accumulator, value: unknown): boolean {
  const numeric = pivotNumber(value);
  if (numeric === null) return false;
  acc.sum += numeric;
  acc.count += 1;
  acc.min = Math.min(acc.min, numeric);
  acc.max = Math.max(acc.max, numeric);
  return true;
}

function emptyAcc(): Accumulator {
  return { sum: 0, count: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY };
}

/**
 * 把多个累加器合并（合计行/列用）。
 * 合并的是 sum/count/min/max 四个原始量，而不是"已算好的 aggregate"——
 * avg 的合计不能对平均值再求平均。
 */
function mergeAcc(target: Accumulator, source: Accumulator): void {
  target.sum += source.sum;
  target.count += source.count;
  target.min = Math.min(target.min, source.min);
  target.max = Math.max(target.max, source.max);
}

function aggregateOf(acc: Accumulator, aggregation: PivotAggregation): number | null {
  if (acc.count === 0) return null;
  switch (aggregation) {
    case 'count':
      return acc.count;
    case 'avg':
      return acc.sum / acc.count;
    case 'min':
      return acc.min;
    case 'max':
      return acc.max;
    default:
      return acc.sum;
  }
}

/** 键排序：数字/日期按大小，文本按本地化字典序，空值永远在最后 */
function compareKeys(a: PivotKey, b: PivotKey): number {
  if (a.blank !== b.blank) return a.blank ? 1 : -1;
  if (a.blank && b.blank) return 0;
  if (a.numeric !== null && b.numeric !== null) return a.numeric - b.numeric;
  if (a.numeric !== null) return -1;
  if (b.numeric !== null) return 1;
  return a.label.localeCompare(b.label, undefined, { numeric: true });
}

/** 多级字段的复合键（行/列可以有多个字段） */
function compositeKey(
  keys: PivotKey[],
  fields: number[],
): { key: string; label: string; blank: boolean; numeric: number | null } {
  if (fields.length === 0) return { key: '', label: '', blank: false, numeric: null };
  const parts = fields.map((field) => keys[field]);
  return {
    key: parts.map((part) => part.key).join('\u0001'),
    label: parts.map((part) => part.label).join(' / '),
    blank: parts.every((part) => part.blank),
    numeric: parts.length === 1 ? parts[0].numeric : null,
  };
}

/**
 * 计算交叉表。
 *
 * 单字段行/列时按值排序；多字段时按字段顺序逐级排序（Excel 的默认行为）。
 */
export function computePivot(config: PivotConfig, source: PivotSource): PivotResult {
  const rowFields = config.rows.filter((field) => field >= 0 && field < source.fields.length);
  const colFields = config.cols.filter((field) => field >= 0 && field < source.fields.length);
  const valueFields = config.values.filter(
    (field) => field.column >= 0 && field.column < source.fields.length,
  );
  const effectiveValues: PivotValueField[] = valueFields.length
    ? valueFields
    : [{ column: 0, aggregation: 'count' }];

  const rowIndex = new Map<string, number>();
  const colIndex = new Map<string, number>();
  const rowKeys: PivotKey[][] = [];
  const colKeys: PivotKey[][] = [];

  // cells[row][col][valueFieldIndex]
  const cells: Accumulator[][][] = [];
  const rowTotals: Accumulator[][] = [];
  const colTotals: Accumulator[][] = [];
  const grand: Accumulator[] = effectiveValues.map(() => emptyAcc());
  let skippedValues = 0;

  const matchesFilters = (record: PivotRecord): boolean =>
    Object.entries(config.filters).every(([columnText, allowed]) => {
      if (!allowed || allowed.length === 0) return true;
      const column = Number(columnText);
      const key = record.keys[column];
      if (!key) return true;
      return allowed.includes(key.key);
    });

  for (const record of source.records) {
    if (!matchesFilters(record)) continue;
    const rowKey = compositeKey(record.keys, rowFields);
    const colKey = compositeKey(record.keys, colFields);
    let r = rowIndex.get(rowKey.key);
    if (r === undefined) {
      r = rowKeys.length;
      rowIndex.set(rowKey.key, r);
      rowKeys.push(rowFields.map((field) => record.keys[field]));
      cells.push([]);
      rowTotals.push(effectiveValues.map(() => emptyAcc()));
    }
    let c = colIndex.get(colKey.key);
    if (c === undefined) {
      c = colKeys.length;
      colIndex.set(colKey.key, c);
      colKeys.push(colFields.map((field) => record.keys[field]));
      for (const row of cells) row[c] = effectiveValues.map(() => emptyAcc());
      colTotals.push(effectiveValues.map(() => emptyAcc()));
    }

    // 新行/新列的格子可能还没建出来：先补成矩形，避免后面按下标取值时出现 undefined
    if (!cells[r][c]) cells[r][c] = effectiveValues.map(() => emptyAcc());

    effectiveValues.forEach((valueField, index) => {
      const value = record.values[valueField.column];
      const target = cells[r][c][index];
      if (valueField.aggregation === 'count') {
        if (isPresent(value)) target.count += 1;
      } else if (!addTo(target, value)) {
        skippedValues += 1;
      }
    });
  }

  // 行/列合计要把"该行所有列"合并，而不是逐格累加（逐格会把同一格重复计入）
  for (let r = 0; r < cells.length; r += 1) {
    rowTotals[r] = effectiveValues.map(() => emptyAcc());
    for (let c = 0; c < colKeys.length; c += 1) {
      effectiveValues.forEach((_, index) => {
        // 行可能在某个列之后才出现，那个格子从来不会被写：跳过而不是当成 0
        const cell = cells[r][c]?.[index];
        if (cell) mergeAcc(rowTotals[r][index], cell);
      });
    }
  }
  for (let c = 0; c < colKeys.length; c += 1) {
    colTotals[c] = effectiveValues.map(() => emptyAcc());
    for (let r = 0; r < cells.length; r += 1) {
      effectiveValues.forEach((_, index) => {
        const cell = cells[r][c]?.[index];
        if (cell) mergeAcc(colTotals[c][index], cell);
      });
    }
  }
  for (let index = 0; index < effectiveValues.length; index += 1) {
    grand[index] = emptyAcc();
    for (let r = 0; r < cells.length; r += 1) mergeAcc(grand[index], rowTotals[r][index]);
  }

  const orderRows = rowKeys.map((keys, index) => ({ keys, index }));
  orderRows.sort((a, b) => {
    for (let level = 0; level < rowFields.length; level += 1) {
      const result = compareKeys(a.keys[level], b.keys[level]);
      if (result !== 0) return result;
    }
    return a.index - b.index;
  });
  const orderCols = colKeys.map((keys, index) => ({ keys, index }));
  orderCols.sort((a, b) => {
    for (let level = 0; level < colFields.length; level += 1) {
      const result = compareKeys(a.keys[level], b.keys[level]);
      if (result !== 0) return result;
    }
    return a.index - b.index;
  });

  // 值字段只有第一个参与展示（首版：多值字段按列展开留待下一批）
  const primary = effectiveValues[0];
  const empty = emptyAcc();
  const sortedCells = orderRows.map((row) =>
    orderCols.map((col) =>
      aggregateOf(cells[row.index][col.index]?.[0] ?? empty, primary.aggregation),
    ),
  );

  return {
    fields: source.fields,
    rowFields,
    colFields,
    rowKeys: orderRows.map((item) => item.keys),
    colKeys: orderCols.map((item) => item.keys),
    cells: sortedCells,
    rowTotals: orderRows.map((row) => aggregateOf(rowTotals[row.index][0], primary.aggregation)),
    colTotals: orderCols.map((col) => aggregateOf(colTotals[col.index][0], primary.aggregation)),
    grandTotal: aggregateOf(grand[0], primary.aggregation),
    skippedValues,
    truncated: source.truncated,
  };
}

/** 便捷入口：读源 + 计算（面板与导出都走这一条，保证两处结果一致） */
export function buildPivot(snapshot: WorkbookLike, config: PivotConfig): PivotResult {
  return computePivot(config, readPivotSource(snapshot, config));
}

/** 源区域里的所有可选键（筛选下拉用），按同样的排序规则 */
export function collectFieldKeys(source: PivotSource, column: number): PivotKey[] {
  const seen = new Map<string, PivotKey>();
  for (const record of source.records) {
    const key = record.keys[column];
    if (key && !seen.has(key.key)) seen.set(key.key, key);
  }
  return [...seen.values()].sort(compareKeys);
}

/**
 * 交叉表 -> 值矩阵（导出 xlsx / 打印共用）。
 *
 * 首行是列键、首列是行键，合计行列跟随在其后；数值按 `aggregation` 的小数位处理
 * （avg 保留两位，其余保持原值，避免把整数聚合结果写成 3.0000000001 这种）。
 */
export function pivotToMatrix(
  result: PivotResult,
  config: PivotConfig,
  blankLabel: string,
): (string | number)[][] {
  const aggregation = config.values[0]?.aggregation ?? 'count';
  const round = (value: number | null): number | null => {
    if (value === null) return null;
    return aggregation === 'avg' ? Math.round(value * 100) / 100 : value;
  };
  const labelOf = (keys: PivotKey[]): string => {
    const text = keys.map((key) => (key.blank ? blankLabel : key.label)).join(' / ');
    return text || blankLabel;
  };

  // 没有列字段时 `colKeys` 仍有一个"复合空键"，不能拿它判断有没有列维度
  const hasCols = result.colFields.length > 0;
  const header: (string | number)[] = [''];
  if (hasCols) {
    for (const keys of result.colKeys) header.push(labelOf(keys));
  } else {
    // 单列结果：表头写值字段名，导出/打印时才知道这列是什么
    header.push(result.fields[config.values[0]?.column ?? 0]?.label ?? '');
  }
  // 没有列字段时只有一列"总计"，此时不需要再追加一个合计列
  if (hasCols) header.push('');

  const matrix: (string | number)[][] = [header];
  result.rowKeys.forEach((keys, rowIndex) => {
    const line: (string | number)[] = [labelOf(keys)];
    for (const value of result.cells[rowIndex]) {
      const rounded = round(value);
      line.push(rounded === null ? '' : rounded);
    }
    if (hasCols) {
      const total = round(result.rowTotals[rowIndex]);
      line.push(total === null ? '' : total);
    }
    matrix.push(line);
  });

  if (hasCols) {
    const totals: (string | number)[] = [''];
    for (const value of result.colTotals) {
      const rounded = round(value);
      totals.push(rounded === null ? '' : rounded);
    }
    const grand = round(result.grandTotal);
    totals.push(grand === null ? '' : grand);
    matrix.push(totals);
  }

  return matrix;
}
