import { columnIndexToName, excelSerialToDate } from './core';
import {
  compileCalcFields,
  evaluateRecord,
  type CalcErrorCode,
  type CalcFieldSpec,
} from './pivotCalc';

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

export type PivotAggregation = 'sum' | 'count' | 'countDistinct' | 'avg' | 'min' | 'max';

export const PIVOT_AGGREGATIONS: readonly PivotAggregation[] = [
  'sum',
  'count',
  'countDistinct',
  'avg',
  'min',
  'max',
];

/**
 * 显示方式（P1-7）。
 *
 * 只作用于**正文单元格**：`percentTotal/percentRow/percentColumn` 会把对应的合计改写为 100%，
 * 因为"行占比"的行合计按定义就是 100%；`rank` 不改合计（合计没有名次，留原始聚合值更诚实）。
 */
export type PivotShowAs = 'normal' | 'percentTotal' | 'percentRow' | 'percentColumn' | 'rank';

export const PIVOT_SHOW_AS: readonly PivotShowAs[] = [
  'normal',
  'percentTotal',
  'percentRow',
  'percentColumn',
  'rank',
];

/** 显示方式 → i18n key（面板与导出/打印共用，避免两处各写一遍） */
export const PIVOT_SHOW_AS_LABEL_KEY: Record<PivotShowAs, string> = {
  normal: 'tools.sheet.pivotShowAsNormal',
  percentTotal: 'tools.sheet.pivotShowAsPercentTotal',
  percentRow: 'tools.sheet.pivotShowAsPercentRow',
  percentColumn: 'tools.sheet.pivotShowAsPercentColumn',
  rank: 'tools.sheet.pivotShowAsRank',
};

/** 源区域单元格预算：超过就只聚合前 N 行并置 `truncated`，绝不静默截断 */
export const PIVOT_SOURCE_LIMIT = 50_000;

/** 0-based 闭区间，与 `print.ts:CellRange` 同一口径 */
export interface PivotRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

/** 计算字段定义（P1-7 ③）；与 `pivotCalc.ts` 的 `CalcFieldSpec` 同一形状 */
export type PivotCalculatedField = CalcFieldSpec;

export interface PivotValueField {
  /** 源区域内的列偏移（0 = 第一列）；计算字段写 -1 */
  column: number;
  aggregation: PivotAggregation;
  /** 显示方式；缺省 = 正常值（老快照不带这个字段） */
  showAs?: PivotShowAs;
  /**
   * 计算字段 id（P1-7 ③）。存在时值来自表达式求值，`column` 不参与计算。
   *
   * 用 id 而不是把表达式塞进 `values`：同一份表达式可以配两种聚合
   * （"金额-成本"求和 + 求平均），面板也按 id 编辑/删除。
   */
  calcId?: string;
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
  /** 计算字段定义（P1-7 ③）；值区通过 `values[].calcId` 引用 */
  calcFields?: PivotCalculatedField[];
  /** 列偏移 -> 允许的键值集合；缺省表示不过滤 */
  filters: Record<number, string[]>;
  /** 首行是否为字段名 */
  hasHeader: boolean;
  /**
   * 已经插入到文档里的透视结果工作表 id。
   *
   * 面板「插入到文档」写一次值并记下这张表；之后再点就是更新它（不新增副本），
   * 导出也复用这张表（不重复追加工作表，原生 `pivotTable` part 直接挂在它上面）。
   */
  outputSheetId?: string;
}

/* ---------------------------- 多实例（P1-7 ①） ---------------------------- */

/** 新实例 id：`pivot-1..n`，跳过已被占用的（删掉中间某个再新建时不会撞号） */
export function nextPivotId(configs: readonly PivotConfig[]): string {
  const taken = new Set(configs.map((config) => config.id));
  for (let index = 1; index <= configs.length + 1; index += 1) {
    const id = `pivot-${index}`;
    if (!taken.has(id)) return id;
  }
  return `pivot-${configs.length + 1}`;
}

/**
 * 按 id 就地替换，没有就追加。
 *
 * 不用"每次重排成一项"：切换实例时配置的先后顺序是用户在面板里看到的顺序，
 * 就地替换才不会让列表在编辑时乱跳。
 */
export function upsertPivotConfig(
  configs: readonly PivotConfig[],
  next: PivotConfig,
): PivotConfig[] {
  const index = configs.findIndex((config) => config.id === next.id);
  if (index < 0) return [...configs, next];
  const copy = [...configs];
  copy[index] = next;
  return copy;
}

/** 删掉一个实例；已经插入到文档的结果表不动（那是文档里的真实工作表） */
export function removePivotConfig(configs: readonly PivotConfig[], id: string): PivotConfig[] {
  return configs.filter((config) => config.id !== id);
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

/** 一个值字段的结果块：多值字段时并排展开（Excel 的"列 × 值"二维表头） */
export interface PivotBlock {
  valueField: PivotValueField;
  /** 该值字段在源区域里的列标签（表头第二行显示） */
  label: string;
  /** 该块的显示方式：矩阵/面板据此给标签加"占比 / 排名"后缀 */
  showAs: PivotShowAs;
  /** cells[row][col]，null = 该组合没有可聚合的值 */
  cells: (number | null)[][];
  rowTotals: (number | null)[];
  colTotals: (number | null)[];
  grandTotal: number | null;
}

export interface PivotResult {
  fields: PivotField[];
  rowFields: number[];
  colFields: number[];
  rowKeys: PivotKey[][];
  colKeys: PivotKey[][];
  /** 每个值字段一块（顺序与 `config.values` 一致） */
  blocks: PivotBlock[];
  /**
   * `blocks[0]` 的快捷方式：单值字段是最常见的情况，UI / 导出 / 打印都能少一层下标。
   * 多值场景请用 `blocks`，这里的数字只代表第一个值字段。
   */
  cells: (number | null)[][];
  rowTotals: (number | null)[];
  colTotals: (number | null)[];
  grandTotal: number | null;
  /** 值字段遇到文本而跳过的单元格数 */
  skippedValues: number;
  /**
   * 计算字段 id → 错误码（P1-7 ③）。
   *
   * 出错的字段仍会占一列（整列为空），面板据此把值区标签标红并给出原因——
   * 静默删掉用户配的字段，比显示一列空更难排查。
   */
  calcErrors?: Record<string, CalcErrorCode>;
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
  /**
   * 去重计数的键集合（只有 countDistinct 字段才会建）。
   *
   * 用 `normalizeKey` 的规范化结果做键：`1` 与 `'1'`、`2026-01-01 08:00` 与 `2026-01-01`
   * 不能算成两个不同的值，否则"去重"只是在数原始字符串。
   */
  distinct?: Set<string>;
}

/** 去重计数：非空才算一个值（文本也计，和 Excel 的"非重复计数"一致） */
function addDistinct(acc: Accumulator, value: unknown): void {
  if (!isPresent(value)) return;
  const key = normalizeKey(value, undefined).key;
  (acc.distinct ??= new Set<string>()).add(key);
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
  if (source.distinct) {
    const set = (target.distinct ??= new Set<string>());
    for (const key of source.distinct) set.add(key);
  }
}

function aggregateOf(acc: Accumulator, aggregation: PivotAggregation): number | null {
  // 去重计数只有文本时 count 仍是 0，必须在 count 判定之前处理
  if (aggregation === 'countDistinct') return acc.distinct?.size ? acc.distinct.size : null;
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
/** 百分比保留两位小数（1/3 → 33.33），避免矩阵里出现 33.33333333333333 */
function percent(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 占比：分母为 0 / 缺失时给 null（Excel 里是空单元格，不是 #DIV/0!） */
function ratio(value: number | null, total: number | null): number | null {
  if (value === null || total === null || total === 0) return null;
  return percent((value / total) * 100);
}

/**
 * 显示方式（P1-7）：只改**数值**，不改结构。
 *
 * - 占比三种：分母分别是总计 / 行合计 / 列合计，对应的合计行改写为 100%；
 * - 排名：每列内按降序排名（1 = 最大），并列取同名次；合计列没有名次，保留原始聚合值。
 */
function applyShowAs(block: PivotBlock): PivotBlock {
  const showAs = block.showAs;
  if (showAs === 'normal') return block;
  if (showAs === 'rank') {
    const cells = block.cells.map((row) => [...row]);
    for (let col = 0; col < (block.colTotals.length ?? 0); col += 1) {
      const values = block.cells.map((row) => row[col]).filter((value) => value !== null);
      for (let row = 0; row < cells.length; row += 1) {
        const value = cells[row][col];
        if (value === null) continue;
        // 并列取同名次：名次 = 比自己大的值的个数 + 1
        cells[row][col] = values.filter((other) => other > value).length + 1;
      }
    }
    return { ...block, cells };
  }

  const cells = block.cells.map((row, rowIndex) =>
    row.map((value, colIndex) => {
      if (showAs === 'percentTotal') return ratio(value, block.grandTotal);
      if (showAs === 'percentRow') return ratio(value, block.rowTotals[rowIndex]);
      return ratio(value, block.colTotals[colIndex]);
    }),
  );
  return {
    ...block,
    cells,
    rowTotals:
      showAs === 'percentRow'
        ? block.rowTotals.map((value) => (value === null ? null : 100))
        : block.rowTotals,
    colTotals:
      showAs === 'percentColumn'
        ? block.colTotals.map((value) => (value === null ? null : 100))
        : block.colTotals,
    grandTotal:
      showAs === 'percentTotal' ? (block.grandTotal === null ? null : 100) : block.grandTotal,
  };
}

export function computePivot(config: PivotConfig, source: PivotSource): PivotResult {
  const rowFields = config.rows.filter((field) => field >= 0 && field < source.fields.length);
  const colFields = config.cols.filter((field) => field >= 0 && field < source.fields.length);
  const calcFields = config.calcFields ?? [];
  const calcNames = new Map(calcFields.map((field) => [field.id, field.name]));
  const valueFields = config.values.filter((field) =>
    field.calcId
      ? calcNames.has(field.calcId)
      : field.column >= 0 && field.column < source.fields.length,
  );
  const effectiveValues: PivotValueField[] = valueFields.length
    ? valueFields
    : [{ column: 0, aggregation: 'count' }];
  /**
   * 计算字段：编译一次（语法 / 引用 / 环），逐条记录求值。
   *
   * 编译失败的字段仍然占一列、整列为空——错误码经 `calcErrors` 交给面板显示，
   * 不在这里悄悄丢掉用户配的字段。
   */
  const compiled = calcFields.length
    ? compileCalcFields(
        calcFields,
        source.fields.map((field) => field.label),
      )
    : null;

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

    const calcValues = compiled ? evaluateRecord(compiled, record.values, pivotNumber) : null;
    effectiveValues.forEach((valueField, index) => {
      const value = valueField.calcId
        ? (calcValues?.get(valueField.calcId) ?? null)
        : record.values[valueField.column];
      const target = cells[r][c][index];
      if (valueField.aggregation === 'count') {
        if (isPresent(value)) target.count += 1;
      } else if (valueField.aggregation === 'countDistinct') {
        addDistinct(target, value);
      } else if (!addTo(target, value)) {
        // 计算字段的 null 是"算不出来"（缺字段 / 除零），不是"源单元格是文本"，
        // 记进 skippedValues 会让提示变成一句误导人的"非数值单元格"
        if (!valueField.calcId) skippedValues += 1;
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

  const empty = emptyAcc();
  // 每个值字段一块：同一份分组结果，按各自的聚合方式折算，再按显示方式改写
  const blocks: PivotBlock[] = effectiveValues.map((valueField, index) => {
    const block: PivotBlock = {
      valueField,
      label: valueField.calcId
        ? (calcNames.get(valueField.calcId) ?? valueField.calcId)
        : (source.fields[valueField.column]?.label ??
          columnIndexToName(config.range.startColumn + valueField.column)),
      showAs: valueField.showAs ?? 'normal',
      cells: orderRows.map((row) =>
        orderCols.map((col) =>
          aggregateOf(cells[row.index][col.index]?.[index] ?? empty, valueField.aggregation),
        ),
      ),
      rowTotals: orderRows.map((row) =>
        aggregateOf(rowTotals[row.index][index], valueField.aggregation),
      ),
      colTotals: orderCols.map((col) =>
        aggregateOf(colTotals[col.index][index], valueField.aggregation),
      ),
      grandTotal: aggregateOf(grand[index], valueField.aggregation),
    };
    return applyShowAs(block);
  });
  const first = blocks[0];

  return {
    fields: source.fields,
    rowFields,
    colFields,
    rowKeys: orderRows.map((item) => item.keys),
    colKeys: orderCols.map((item) => item.keys),
    blocks,
    cells: first.cells,
    rowTotals: first.rowTotals,
    colTotals: first.colTotals,
    grandTotal: first.grandTotal,
    skippedValues,
    truncated: source.truncated,
    calcErrors:
      compiled && compiled.errors.size > 0 ? Object.fromEntries(compiled.errors) : undefined,
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
 * 表头里值字段的显示文本。
 *
 * 显示方式必须体现在标签上——只写 "33.33" 的那一列，没人分得清是金额还是百分比。
 * 后缀文案由调用方从 i18n 传入（`pivot.ts` 是纯计算层，不认语言）。
 */
export function pivotValueLabel(block: PivotBlock, suffix = ''): string {
  return suffix ? `${block.label} (${suffix})` : block.label;
}

/**
 * 交叉表 -> 值矩阵（导出 xlsx / 打印共用）。
 *
 * 表头行数 = 列字段个数（没有列字段时为 1，放"值"标题）+ 多值时的 1 行值字段名；
 * 首列是行键，合计行列跟随在其后；数值按 `aggregation` 的小数位处理
 * （avg 保留两位，其余保持原值，避免把整数聚合结果写成 3.0000000001 这种）。
 *
 * 为什么表头行数要跟列字段个数走：Excel 原生透视表一个列字段占一行表头，
 * `pivotXlsx.ts` 的 `firstDataRow` 也按同样口径写。静态矩阵把多级列头拼成一行
 * （`Q1 / 金额`）就会与 `location` 错开——刷新后整表被往下压。
 */
export function pivotToMatrix(
  result: PivotResult,
  config: PivotConfig,
  blankLabel: string,
  /**
   * 值字段标签的渲染（表头里那一行文字）。
   *
   * 显示方式（占比 / 排名）必须体现在标签上，否则"33.33"这一列没人知道是钱还是百分比；
   * 但 `pivot.ts` 是纯计算层、不认语言，所以后缀文案由调用方注入。
   */
  valueLabel?: (block: PivotBlock) => string,
  /** 多值且没有列字段时，表头第一行的标题（Excel 里是"值"/"Values"），由调用方按语言注入 */
  valuesCaption = '',
): (string | number)[][] {
  const labelFor = valueLabel ?? ((block: PivotBlock) => block.label);
  const blocks = result.blocks.length
    ? result.blocks
    : [
        {
          valueField: config.values[0] ?? { column: 0, aggregation: 'count' as const },
          label: '',
          showAs: 'normal' as const,
          cells: result.cells,
          rowTotals: result.rowTotals,
          colTotals: result.colTotals,
          grandTotal: result.grandTotal,
        },
      ];
  const multi = blocks.length > 1;
  const round = (
    value: number | null,
    aggregation: PivotValueField['aggregation'],
  ): number | null => {
    if (value === null) return null;
    return aggregation === 'avg' ? Math.round(value * 100) / 100 : value;
  };
  const labelOf = (keys: PivotKey[]): string => {
    const text = keys.map((key) => (key.blank ? blankLabel : key.label)).join(' / ');
    return text || blankLabel;
  };

  // 没有列字段时 `colKeys` 仍有一个"复合空键"，不能拿它判断有没有列维度
  const hasCols = result.colFields.length > 0;
  /**
   * 表头行数必须和 Excel 原生透视表一致：**每个列字段占一行**（没有列字段时用一行放"值"标题），
   * 多值再加一行值字段名。静态矩阵不合并单元格，所以组内每列都重复上级标题——
   * 只占一行的拼接写法（`Q1 / 金额`）会让刷新后的原生表头多出几行，整表往下压。
   */
  const colLevels = hasCols ? result.colFields.length : 0;
  const headerRows = Math.max(colLevels, 1) + (multi ? 1 : 0);
  const measureRow = multi ? headerRows - 1 : -1;
  const header: (string | number)[][] = Array.from({ length: headerRows }, () => ['']);

  const headerCell = (level: number, keys: PivotKey[], block: PivotBlock): string => {
    if (!hasCols) {
      if (multi) return level === measureRow ? labelFor(block) : valuesCaption;
      // 单列结果：表头写值字段名，导出/打印时才知道这列是什么
      return labelFor(block) || (result.fields[config.values[0]?.column ?? 0]?.label ?? '');
    }
    if (level === measureRow) return labelFor(block);
    const key = keys[level];
    if (!key) return '';
    return key.blank ? blankLabel : key.label;
  };

  const columns = hasCols ? result.colKeys.length : 1;
  for (let col = 0; col < columns; col += 1) {
    const keys = hasCols ? result.colKeys[col] : [];
    for (const block of blocks) {
      for (let level = 0; level < headerRows; level += 1) {
        header[level].push(headerCell(level, keys, block));
      }
    }
  }
  // 合计块：非值字段名的那些行留空（Excel 里是合并的"总计"标题），与单值版一致
  if (hasCols) {
    for (const block of blocks) {
      for (let level = 0; level < headerRows; level += 1) {
        header[level].push(level === measureRow ? labelFor(block) : '');
      }
    }
  }

  const matrix: (string | number)[][] = header;
  result.rowKeys.forEach((keys, rowIndex) => {
    const line: (string | number)[] = [labelOf(keys)];
    for (let col = 0; col < (hasCols ? result.colKeys.length : 1); col += 1) {
      for (const block of blocks) {
        const rounded = round(block.cells[rowIndex][col], block.valueField.aggregation);
        line.push(rounded === null ? '' : rounded);
      }
    }
    if (hasCols) {
      for (const block of blocks) {
        const total = round(block.rowTotals[rowIndex], block.valueField.aggregation);
        line.push(total === null ? '' : total);
      }
    }
    matrix.push(line);
  });

  if (hasCols) {
    const totals: (string | number)[] = [''];
    for (let col = 0; col < result.colKeys.length; col += 1) {
      for (const block of blocks) {
        const rounded = round(block.colTotals[col], block.valueField.aggregation);
        totals.push(rounded === null ? '' : rounded);
      }
    }
    for (const block of blocks) {
      const grand = round(block.grandTotal, block.valueField.aggregation);
      totals.push(grand === null ? '' : grand);
    }
    matrix.push(totals);
  }

  return matrix;
}
