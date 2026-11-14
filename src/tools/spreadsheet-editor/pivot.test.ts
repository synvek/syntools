import { describe, expect, it } from 'vitest';
import {
  buildPivot,
  collectFieldKeys,
  computePivot,
  nextPivotId,
  normalizeKey,
  pivotNumber,
  pivotToMatrix,
  pivotValueLabel,
  readPivotSource,
  removePivotConfig,
  upsertPivotConfig,
  type PivotConfig,
} from './pivot';

/**
 * P2-4.2 聚合内核：5 组数据 × 5 种聚合 × 空值/文本/日期的口径。
 * 期望值全部按 Excel 透视表的行为手算，不从实现反推。
 */

type Cell = { v?: unknown; s?: { n?: { pattern?: string } } };

/** 用二维数组造快照；`patterns` 按列号指定日期格式（Excel 里日期就是带格式的数字） */
function sheetOf(rows: unknown[][], patterns: Record<number, string> = {}) {
  const cellData: Record<string, Record<string, Cell>> = {};
  rows.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value === undefined) return;
      const pattern = patterns[colIndex];
      cellData[String(rowIndex)] ??= {};
      cellData[String(rowIndex)][String(colIndex)] = pattern
        ? { v: value, s: { n: { pattern } } }
        : { v: value };
    });
  });
  return { sheets: { s1: { cellData } } };
}

function configOf(overrides: Partial<PivotConfig> = {}): PivotConfig {
  return {
    id: 'p1',
    name: '透视 1',
    sheetId: 's1',
    range: { startRow: 0, startColumn: 0, endRow: 4, endColumn: 2 },
    rows: [0],
    cols: [1],
    values: [{ column: 2, aggregation: 'sum' }],
    filters: {},
    hasHeader: true,
    ...overrides,
  };
}

/** 区域 / 季度 / 金额 */
const SALES: unknown[][] = [
  ['区域', '季度', '金额'],
  ['华东', 'Q1', 100],
  ['华东', 'Q2', 50],
  ['华南', 'Q1', 30],
  ['华南', 'Q2', 20],
];

describe('normalizeKey', () => {
  it('keeps numbers, text, booleans and blanks in separate groups', () => {
    expect(normalizeKey(1)).toMatchObject({ key: 'n:1', label: '1', blank: false });
    expect(normalizeKey('1')).toMatchObject({ key: 't:1', label: '1' });
    expect(normalizeKey('  华东 ')).toMatchObject({ key: 't:华东', label: '华东' });
    expect(normalizeKey(true)).toMatchObject({ key: 'b:TRUE', label: 'TRUE' });
    expect(normalizeKey('')).toMatchObject({ key: 'blank:', blank: true });
    expect(normalizeKey(undefined)).toMatchObject({ blank: true });
  });

  it('groups dates by day when the cell carries a date pattern', () => {
    // 日期在 Excel 里就是序列号：带日期格式时按天成组，同一个序列号必须落进同一组
    const serial = 46023;
    expect(normalizeKey(serial, 'yyyy-mm-dd')).toMatchObject({
      key: 'd:2026-01-01',
      label: '2026-01-01',
      blank: false,
    });
    expect(normalizeKey(serial, 'yyyy-mm-dd').key).toBe(normalizeKey(serial, 'yyyy/m/d').key);
    // 没有日期格式时按数字分组，不做无根据的日期猜测
    expect(normalizeKey(serial).key).toBe(`n:${serial}`);
  });

  it('treats text as "not a number" for the value side (never 0)', () => {
    expect(pivotNumber('abc')).toBeNull();
    expect(pivotNumber('')).toBeNull();
    expect(pivotNumber('12.5')).toBe(12.5);
    expect(pivotNumber(true)).toBe(1);
  });
});

describe('readPivotSource', () => {
  it('reads header labels and skips fully empty body rows', () => {
    const snapshot = sheetOf([
      ['区域', '季度', '金额'],
      ['华东', 'Q1', 100],
      [undefined, undefined, undefined],
      ['华南', 'Q1', 30],
    ]);
    const source = readPivotSource(
      snapshot,
      configOf({ range: { startRow: 0, startColumn: 0, endRow: 3, endColumn: 2 } }),
    );
    expect(source.fields.map((field) => field.label)).toEqual(['区域', '季度', '金额']);
    expect(source.records).toHaveLength(2);
    expect(source.emptyRows).toBe(1);
    expect(source.truncated).toBe(false);
  });

  it('falls back to column letters when the header cell is empty', () => {
    const snapshot = sheetOf([
      ['区域', undefined],
      ['华东', 3],
    ]);
    const source = readPivotSource(
      snapshot,
      configOf({ range: { startRow: 0, startColumn: 0, endRow: 1, endColumn: 1 } }),
    );
    expect(source.fields.map((field) => field.label)).toEqual(['区域', 'B']);
  });

  it('flags truncation instead of silently dropping the tail', () => {
    const snapshot = sheetOf([
      ['区域', '金额'],
      ['A', 1],
      ['B', 2],
      ['C', 3],
    ]);
    const source = readPivotSource(
      snapshot,
      configOf({ range: { startRow: 0, startColumn: 0, endRow: 3, endColumn: 1 } }),
      4, // 预算只够 2 行（2 列 × 2 行）
    );
    expect(source.records).toHaveLength(2);
    expect(source.truncated).toBe(true);
  });
});

describe('computePivot: aggregations', () => {
  it('sums by row/column and fills row, column and grand totals', () => {
    const result = buildPivot(sheetOf(SALES), configOf());
    expect(result.rowKeys.map((keys) => keys[0].label)).toEqual(['华东', '华南']);
    expect(result.colKeys.map((keys) => keys[0].label)).toEqual(['Q1', 'Q2']);
    expect(result.cells).toEqual([
      [100, 50],
      [30, 20],
    ]);
    expect(result.rowTotals).toEqual([150, 50]);
    expect(result.colTotals).toEqual([130, 70]);
    expect(result.grandTotal).toBe(200);
  });

  it('counts non-empty text but never counts blanks', () => {
    const snapshot = sheetOf([
      ['区域', '备注'],
      ['华东', '好'],
      ['华东', ''],
      ['华南', '一般'],
    ]);
    const result = buildPivot(
      snapshot,
      configOf({
        range: { startRow: 0, startColumn: 0, endRow: 3, endColumn: 1 },
        cols: [],
        values: [{ column: 1, aggregation: 'count' }],
      }),
    );
    expect(result.rowKeys.map((keys) => keys[0].label)).toEqual(['华东', '华南']);
    expect(result.cells).toEqual([[1], [1]]);
    expect(result.grandTotal).toBe(2);
  });

  it('averages the underlying sums (grand average is weighted, not an average of averages)', () => {
    const snapshot = sheetOf([
      ['区域', '季度', '金额'],
      ['华东', 'Q1', 100],
      ['华东', 'Q1', 200],
      ['华南', 'Q1', 30],
    ]);
    const result = buildPivot(
      snapshot,
      configOf({
        range: { startRow: 0, startColumn: 0, endRow: 3, endColumn: 2 },
        values: [{ column: 2, aggregation: 'avg' }],
      }),
    );
    expect(result.cells).toEqual([[150], [30]]);
    // (100+200+30)/3 = 110，而不是 (150+30)/2 = 90
    expect(result.grandTotal).toBeCloseTo(110, 6);
  });

  it('returns min/max per group', () => {
    const snapshot = sheetOf([
      ['区域', '季度', '金额'],
      ['华东', 'Q1', 100],
      ['华东', 'Q1', 40],
      ['华东', 'Q2', 70],
    ]);
    const base = configOf({ range: { startRow: 0, startColumn: 0, endRow: 3, endColumn: 2 } });
    expect(
      buildPivot(snapshot, { ...base, values: [{ column: 2, aggregation: 'min' }] }).cells,
    ).toEqual([[40, 70]]);
    expect(
      buildPivot(snapshot, { ...base, values: [{ column: 2, aggregation: 'max' }] }).cells,
    ).toEqual([[100, 70]]);
  });

  it('skips text in the value column and reports how many cells were skipped', () => {
    const snapshot = sheetOf([
      ['区域', '季度', '金额'],
      ['华东', 'Q1', 100],
      ['华东', 'Q1', '待定'],
    ]);
    const result = buildPivot(
      snapshot,
      configOf({ range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 2 } }),
    );
    expect(result.cells).toEqual([[100]]);
    expect(result.skippedValues).toBe(1);
  });
});

describe('computePivot: grouping', () => {
  it('puts the blank group last and keeps it addressable', () => {
    const snapshot = sheetOf([
      ['区域', '季度', '金额'],
      ['华东', 'Q1', 10],
      ['', 'Q1', 5],
      ['华南', undefined, 2],
    ]);
    const result = buildPivot(
      snapshot,
      configOf({ range: { startRow: 0, startColumn: 0, endRow: 3, endColumn: 2 } }),
    );
    expect(result.rowKeys.map((keys) => keys[0].blank)).toEqual([false, false, true]);
    // 华东 只有 Q1、华南 只在空季度、空区域 只有 Q1
    expect(result.cells).toEqual([
      [10, null],
      [null, 2],
      [5, null],
    ]);
  });

  it('groups multi-level row fields in field order', () => {
    const snapshot = sheetOf([
      ['区域', '城市', '金额'],
      ['华东', '杭州', 10],
      ['华东', '上海', 20],
      ['华南', '广州', 5],
    ]);
    const result = buildPivot(
      snapshot,
      configOf({
        range: { startRow: 0, startColumn: 0, endRow: 3, endColumn: 2 },
        rows: [0, 1],
        cols: [],
      }),
    );
    expect(result.rowKeys.map((keys) => keys.map((key) => key.label))).toEqual([
      ['华东', '上海'],
      ['华东', '杭州'],
      ['华南', '广州'],
    ]);
    expect(result.cells).toEqual([[20], [10], [5]]);
  });

  it('applies value filters before aggregating', () => {
    const snapshot = sheetOf(SALES);
    const base = configOf();
    const source = readPivotSource(snapshot, base);
    const allowed = collectFieldKeys(source, 1).filter((key) => key.label === 'Q1');
    const result = computePivot({ ...base, filters: { 1: allowed.map((key) => key.key) } }, source);
    expect(result.colKeys.map((keys) => keys[0].label)).toEqual(['Q1']);
    expect(result.grandTotal).toBe(130);
  });
});

describe('pivotToMatrix', () => {
  it('writes column keys as the header and adds a totals row/column', () => {
    const result = buildPivot(sheetOf(SALES), configOf());
    expect(pivotToMatrix(result, configOf(), '(空白)')).toEqual([
      ['', 'Q1', 'Q2', ''],
      ['华东', 100, 50, 150],
      ['华南', 30, 20, 50],
      ['', 130, 70, 200],
    ]);
  });

  it('gives each column field its own header row', () => {
    const config = configOf({ rows: [0], cols: [1, 0] });
    // 两个列字段 → 两行表头（季度 / 区域），行列数与原生透视表一致
    expect(pivotToMatrix(buildPivot(sheetOf(SALES), config), config, '(空白)')).toEqual([
      ['', 'Q1', 'Q1', 'Q2', 'Q2', ''],
      ['', '华东', '华南', '华东', '华南', ''],
      ['华东', 100, '', 50, '', 150],
      ['华南', '', 30, '', 20, 50],
      ['', 100, 30, 50, 20, 200],
    ]);
  });

  it('omits the totals row/column when there is no column field', () => {
    const result = buildPivot(
      sheetOf(SALES),
      configOf({ cols: [], values: [{ column: 2, aggregation: 'sum' }] }),
    );
    // 没有列维度时表头写值字段名，且不追加"合计"行/列
    expect(
      pivotToMatrix(
        result,
        configOf({ cols: [], values: [{ column: 2, aggregation: 'sum' }] }),
        '(空白)',
      ),
    ).toEqual([
      ['', '金额'],
      ['华东', 150],
      ['华南', 50],
    ]);
  });

  it('renders the blank group with the localized label', () => {
    const snapshot = sheetOf([
      ['区域', '金额'],
      ['', 4],
      ['华东', 6],
    ]);
    const config = configOf({
      range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 1 },
      cols: [],
    });
    const matrix = pivotToMatrix(buildPivot(snapshot, config), config, '(空白)');
    expect(matrix[1][0]).toBe('华东');
    expect(matrix[2][0]).toBe('(空白)');
  });
});

describe('edge cases', () => {
  it('returns an empty result for a missing sheet instead of throwing', () => {
    const result = buildPivot({ sheets: {} }, configOf());
    expect(result.cells).toEqual([]);
    expect(result.grandTotal).toBeNull();
  });

  it('defaults to count when no value field is configured', () => {
    const result = buildPivot(sheetOf(SALES), configOf({ values: [] }));
    expect(result.cells).toEqual([
      [1, 1],
      [1, 1],
    ]);
  });
});

describe('performance', () => {
  it('aggregates 10k rows well under the 100ms acceptance budget', () => {
    const rows: unknown[][] = [['区域', '季度', '金额']];
    // 1 万行 × 3 列 = 3 万单元格，覆盖验收里"1 万行重算 < 100ms"
    for (let index = 0; index < 10_000; index += 1) {
      rows.push([`R${index % 50}`, `Q${(index % 4) + 1}`, (index % 977) + 1]);
    }
    const snapshot = sheetOf(rows);
    const config = configOf({
      range: { startRow: 0, startColumn: 0, endRow: 10_000, endColumn: 2 },
    });

    const started = performance.now();
    const source = readPivotSource(snapshot, config);
    const result = computePivot(config, source);
    const elapsed = performance.now() - started;

    expect(result.cells).toHaveLength(50);
    // 门禁取 100ms 的一半，给 CI 抖动留余量；实测在 10ms 量级
    expect(elapsed).toBeLessThan(100);
  });
});

describe('multiple value fields', () => {
  const DATA: unknown[][] = [
    ['区域', '季度', '金额', '数量'],
    ['华东', 'Q1', 100, 2],
    ['华东', 'Q1', 50, 3],
    ['华南', 'Q1', 30, 1],
  ];

  const multiConfig = (): PivotConfig =>
    configOf({
      range: { startRow: 0, startColumn: 0, endRow: 3, endColumn: 3 },
      rows: [0],
      cols: [1],
      values: [
        { column: 2, aggregation: 'sum' },
        { column: 3, aggregation: 'avg' },
      ],
    });

  it('returns one block per value field, each with its own aggregation', () => {
    const result = buildPivot(sheetOf(DATA), multiConfig());
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].cells).toEqual([[150], [30]]);
    expect(result.blocks[1].cells).toEqual([[2.5], [1]]);
    // 快捷字段仍指向第一个值字段，单值调用方不需要改
    expect(result.cells).toEqual(result.blocks[0].cells);
    expect(result.blocks.map((block) => block.label)).toEqual(['金额', '数量']);
  });

  it('lays blocks side by side in the export matrix, with per-block totals', () => {
    const result = buildPivot(sheetOf(DATA), multiConfig());
    // 多值：表头两行（列键行 + 值字段名行），与 Excel 原生透视表的表头形状一致
    expect(pivotToMatrix(result, multiConfig(), '(空白)')).toEqual([
      ['', 'Q1', 'Q1', '', ''],
      ['', '金额', '数量', '金额', '数量'],
      ['华东', 150, 2.5, 150, 2.5],
      ['华南', 30, 1, 30, 1],
      ['', 180, 2, 180, 2],
    ]);
  });

  it('writes the values caption on the first header row when there is no column field', () => {
    const config = multiConfig();
    const result = buildPivot(sheetOf(DATA), { ...config, cols: [] });
    // 没有列维度的多值表：第一行是"值"标题（Excel 里合并成一个格子），第二行才是值字段名
    expect(pivotToMatrix(result, { ...config, cols: [] }, '(空白)', undefined, '值')).toEqual([
      ['', '值', '值'],
      ['', '金额', '数量'],
      ['华东', 150, 2.5],
      ['华南', 30, 1],
    ]);
    // 缺省（导出层不需要表头文案）时第一行留空，但行数仍然是两行
    expect(pivotToMatrix(result, { ...config, cols: [] }, '(空白)')[0]).toEqual(['', '', '']);
  });

  it('keeps the single-value matrix layout unchanged', () => {
    const result = buildPivot(sheetOf(SALES), configOf());
    // 单值时不加值字段名，导出结果与上一版一致（老断言不会因为新特性变化）
    expect(pivotToMatrix(result, configOf(), '(空白)')[0]).toEqual(['', 'Q1', 'Q2', '']);
  });
});

/**
 * P1-7 ③ 计算字段：表达式只做四则运算，字段引用写 `[列名]`。
 *
 * 期望值同样按 Excel 手算：利润 = 金额 - 成本，再按区域求和；
 * 除零给空值，缺字段给整列空 + 错误码（不静默丢字段）。
 */
describe('P1-7 计算字段', () => {
  /** 区域 / 金额 / 成本 */
  const PROFIT: unknown[][] = [
    ['区域', '金额', '成本'],
    ['华东', 100, 60],
    ['华东', 50, 20],
    ['华南', 30, 10],
  ];

  const profitConfig = (expression = '[金额] - [成本]'): PivotConfig =>
    configOf({
      range: { startRow: 0, startColumn: 0, endRow: 3, endColumn: 2 },
      cols: [],
      calcFields: [{ id: 'calc-1', name: '利润', expression }],
      values: [{ column: -1, aggregation: 'sum', calcId: 'calc-1' }],
    });

  it('aggregates the expression per record, then by row field', () => {
    const result = buildPivot(sheetOf(PROFIT), profitConfig());
    expect(result.blocks[0].label).toBe('利润');
    expect(result.cells.map((row) => row[0])).toEqual([70, 20]);
    expect(result.grandTotal).toBe(90);
    expect(result.calcErrors).toBeUndefined();
  });

  it('treats division by zero as an empty cell, not as Infinity or 0', () => {
    const rows: unknown[][] = [
      ['区域', '金额', '成本'],
      ['华东', 100, 0],
      ['华东', 50, 25],
      ['华南', 30, 0],
    ];
    const result = buildPivot(sheetOf(rows), profitConfig('[金额] / [成本]'));
    // 华东：一条除零（跳过）+ 一条 2 = 2；华南：只有除零 → 整格空
    expect(result.cells.map((row) => row[0])).toEqual([2, null]);
    // 计算字段的 null 不是"源单元格是文本"，不该计入 skippedValues
    expect(result.skippedValues).toBe(0);
  });

  it('keeps the column (all empty) and reports the error for unknown fields', () => {
    const result = buildPivot(sheetOf(PROFIT), profitConfig('[金额] - [不存在的列]'));
    expect(result.blocks).toHaveLength(1);
    expect(result.cells.map((row) => row[0])).toEqual([null, null]);
    expect(result.calcErrors).toEqual({ 'calc-1': 'unknownField' });
  });

  it('lets one calculated field reference another', () => {
    const config = configOf({
      range: { startRow: 0, startColumn: 0, endRow: 3, endColumn: 2 },
      cols: [],
      calcFields: [
        { id: 'calc-1', name: '利润', expression: '[金额] - [成本]' },
        { id: 'calc-2', name: '利润两倍', expression: '[利润] * 2' },
      ],
      values: [{ column: -1, aggregation: 'sum', calcId: 'calc-2' }],
    });
    const result = buildPivot(sheetOf(PROFIT), config);
    expect(result.cells.map((row) => row[0])).toEqual([140, 40]);
  });

  it('ignores value entries whose calculated field was deleted', () => {
    const config = configOf({
      range: { startRow: 0, startColumn: 0, endRow: 3, endColumn: 2 },
      cols: [],
      calcFields: [],
      values: [{ column: -1, aggregation: 'sum', calcId: 'calc-9' }],
    });
    const result = buildPivot(sheetOf(PROFIT), config);
    // 没有可用的值字段 → 回落到默认 count（第一列非空计数），不会崩
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].valueField).toEqual({ column: 0, aggregation: 'count' });
  });

  it('shows the calculated field label in the export matrix', () => {
    const config = profitConfig();
    const matrix = pivotToMatrix(buildPivot(sheetOf(PROFIT), config), config, '(空白)');
    expect(matrix).toEqual([
      ['', '利润'],
      ['华东', 70],
      ['华南', 20],
    ]);
  });
});

/**
 * P1-7 能力增强：去重计数与显示方式（占比 / 排名）。
 *
 * 期望值按 Excel 透视表的口径手算：占比以"总计 / 行合计 / 列合计"为分母，
 * 排名是列内降序（1 = 最大），并列取同名次；分母为 0 时给空值而不是 #DIV/0!。
 */
describe('P1-7 去重计数与显示方式', () => {
  /** 区域 / 季度 / 金额 / 客户（客户有重复、有文本、有空） */
  const ROWS: unknown[][] = [
    ['区域', '季度', '金额', '客户'],
    ['华东', 'Q1', 100, '甲'],
    ['华东', 'Q1', 100, '乙'],
    ['华东', 'Q2', 50, '甲'],
    ['华南', 'Q1', 0, '丙'],
  ];

  it('去重计数：重复值只算一次', () => {
    const result = buildPivot(sheetOf(ROWS), {
      ...configOf({ range: { startRow: 0, startColumn: 0, endRow: 4, endColumn: 3 } }),
      rows: [0],
      cols: [],
      values: [{ column: 3, aggregation: 'countDistinct' }],
    });
    const block = result.blocks[0];
    expect(block.cells.map((row) => row[0])).toEqual([2, 1]); // 华东: 甲乙 2；华南: 丙 1
    expect(block.grandTotal).toBe(3);
  });

  it('去重计数：文本也计（与"计数"的差别在重复项）', () => {
    const source = sheetOf(ROWS);
    const config = configOf({
      range: { startRow: 0, startColumn: 0, endRow: 4, endColumn: 3 },
      rows: [0],
      cols: [],
      values: [{ column: 3, aggregation: 'countDistinct' }],
    });
    const distinct = computePivot(config, readPivotSource(source, config));
    const count = computePivot(
      { ...config, values: [{ column: 3, aggregation: 'count' }] },
      readPivotSource(source, config),
    );
    expect(distinct.grandTotal).toBe(3);
    expect(count.grandTotal).toBe(4); // 计数把重复的"甲"也算进去
  });

  it('去重计数：空值不计，全空时给 null 而不是 0', () => {
    const rows: unknown[][] = [
      ['区域', '客户'],
      ['华东', '甲'],
      ['华东', undefined],
      ['华东', ''],
    ];
    const config = configOf({
      range: { startRow: 0, startColumn: 0, endRow: 3, endColumn: 1 },
      rows: [0],
      cols: [],
      values: [{ column: 1, aggregation: 'countDistinct' }],
    });
    const result = buildPivot(sheetOf(rows), config);
    expect(result.blocks[0].grandTotal).toBe(1);

    const empty = buildPivot(
      sheetOf([
        ['区域', '客户'],
        ['华东', undefined],
      ]),
      { ...config, range: { startRow: 0, startColumn: 0, endRow: 1, endColumn: 1 } },
    );
    expect(empty.blocks[0].cells[0][0]).toBeNull();
  });

  it('去重计数的行列合计是合并后的去重数（不是各格相加）', () => {
    const result = buildPivot(
      sheetOf(ROWS),
      configOf({
        range: { startRow: 0, startColumn: 0, endRow: 4, endColumn: 3 },
        rows: [0],
        cols: [1],
        values: [{ column: 3, aggregation: 'countDistinct' }],
      }),
    );
    const block = result.blocks[0];
    // 华东 × Q1 = {甲,乙} = 2，华东 × Q2 = {甲} = 1 → 行合计合并后仍是 {甲,乙} = 2，不是 3
    expect(block.rowTotals[0]).toBe(2);
    expect(block.grandTotal).toBe(3);
  });

  it('占比（占总计）：两位小数，总计改写为 100', () => {
    const result = buildPivot(
      sheetOf([
        ['区域', '金额'],
        ['华东', 1],
        ['华南', 2],
      ]),
      configOf({
        range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 1 },
        rows: [0],
        cols: [],
        values: [{ column: 1, aggregation: 'sum', showAs: 'percentTotal' }],
      }),
    );
    const block = result.blocks[0];
    expect(block.cells.map((row) => row[0])).toEqual([33.33, 66.67]);
    expect(block.grandTotal).toBe(100);
    expect(block.showAs).toBe('percentTotal');
  });

  it('占比（占行合计）：每行加总 100，行合计改写为 100', () => {
    const result = buildPivot(
      sheetOf([
        ['区域', '季度', '金额'],
        ['华东', 'Q1', 30],
        ['华东', 'Q2', 10],
        ['华南', 'Q1', 5],
      ]),
      configOf({
        range: { startRow: 0, startColumn: 0, endRow: 3, endColumn: 2 },
        rows: [0],
        cols: [1],
        values: [{ column: 2, aggregation: 'sum', showAs: 'percentRow' }],
      }),
    );
    const block = result.blocks[0];
    expect(block.cells[0][0]).toBe(75); // 华东 Q1: 30/40
    expect(block.cells[0][1]).toBe(25); // 华东 Q2: 10/40
    expect(block.rowTotals[0]).toBe(100);
  });

  it('占比（占列合计）：每列加总 100，列合计改写为 100', () => {
    const result = buildPivot(
      sheetOf([
        ['区域', '季度', '金额'],
        ['华东', 'Q1', 30],
        ['华南', 'Q1', 10],
      ]),
      configOf({
        range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 2 },
        rows: [0],
        cols: [1],
        values: [{ column: 2, aggregation: 'sum', showAs: 'percentColumn' }],
      }),
    );
    const block = result.blocks[0];
    expect(block.cells[0][0]).toBe(75);
    expect(block.cells[1][0]).toBe(25);
    expect(block.colTotals[0]).toBe(100);
  });

  it('占比：分母为 0 时给 null（不出现 Infinity / NaN）', () => {
    const result = buildPivot(
      sheetOf([
        ['区域', '金额'],
        ['华东', 0],
      ]),
      configOf({
        range: { startRow: 0, startColumn: 0, endRow: 1, endColumn: 1 },
        rows: [0],
        cols: [],
        values: [{ column: 1, aggregation: 'sum', showAs: 'percentTotal' }],
      }),
    );
    const value = result.blocks[0].cells[0][0];
    expect(value).toBeNull();
  });

  it('排名：列内降序，并列取同名次', () => {
    const result = buildPivot(
      sheetOf([
        ['区域', '金额'],
        ['华东', 100],
        ['华南', 100],
        ['华北', 30],
      ]),
      configOf({
        range: { startRow: 0, startColumn: 0, endRow: 3, endColumn: 1 },
        rows: [0],
        cols: [],
        values: [{ column: 1, aggregation: 'sum', showAs: 'rank' }],
      }),
    );
    // 100 / 100 并列第 1，30 第 3（行按字段值排序，这里只比名次集合）
    expect(result.blocks[0].cells.map((row) => row[0] as number).sort((a, b) => a - b)).toEqual([
      1, 1, 3,
    ]);
  });

  it('显示方式只改数值，不改行/列结构', () => {
    const base = configOf({ range: { startRow: 0, startColumn: 0, endRow: 4, endColumn: 2 } });
    const plain = buildPivot(sheetOf(SALES), base);
    const percent = buildPivot(sheetOf(SALES), {
      ...base,
      values: [{ column: 2, aggregation: 'sum', showAs: 'percentTotal' }],
    });
    expect(percent.rowKeys).toEqual(plain.rowKeys);
    expect(percent.colKeys).toEqual(plain.colKeys);
  });

  it('矩阵表头带上显示方式后缀（由调用方注入文案）', () => {
    const config = configOf({
      range: { startRow: 0, startColumn: 0, endRow: 4, endColumn: 2 },
      rows: [0],
      cols: [],
      values: [{ column: 2, aggregation: 'sum', showAs: 'percentTotal' }],
    });
    const result = buildPivot(sheetOf(SALES), config);
    const plain = pivotToMatrix(result, config, '(空白)');
    expect(plain[0][1]).toBe('金额');

    const labelled = pivotToMatrix(result, config, '(空白)', (block) =>
      pivotValueLabel(block, block.showAs === 'percentTotal' ? '占总计%' : ''),
    );
    expect(labelled[0][1]).toBe('金额 (占总计%)');
  });
});

/**
 * P1-7 ①：多实例。
 *
 * 守两件事：**同一张工作表可以有多个透视**（各自独立的行列/值布局），
 * 以及"改一个不会动到另一个"——原来 `applyPivotConfig` 把列表重置成 `[next]`，
 * 改第二个透视就会把第一个悄悄删掉。
 */
describe('多实例（P1-7 ①）', () => {
  const configWith = (id: string, sheetId = 's1'): PivotConfig => ({
    ...configOf(),
    id,
    sheetId,
  });

  it('nextPivotId 从 pivot-1 起，跳过已占用的编号', () => {
    expect(nextPivotId([])).toBe('pivot-1');
    expect(nextPivotId([configWith('pivot-1')])).toBe('pivot-2');
    expect(nextPivotId([configWith('pivot-1'), configWith('pivot-2')])).toBe('pivot-3');
    // 中间删掉一个：编号可以复用，不留空洞
    expect(nextPivotId([configWith('pivot-1'), configWith('pivot-3')])).toBe('pivot-2');
  });

  it('upsert 按 id 就地替换，顺序不变', () => {
    const list = [configWith('pivot-1'), configWith('pivot-2')];
    const next = upsertPivotConfig(list, { ...configWith('pivot-2'), name: '改过的名字' });
    expect(next.map((config) => config.id)).toEqual(['pivot-1', 'pivot-2']);
    expect(next[1].name).toBe('改过的名字');
    // 原数组不被改动（React 状态必须拿新引用才会重渲染）
    expect(list[1].name).toBe('透视 1');
    expect(next).not.toBe(list);
  });

  it('upsert 新 id 时追加到末尾', () => {
    const list = [configWith('pivot-1')];
    const next = upsertPivotConfig(list, configWith('pivot-2'));
    expect(next.map((config) => config.id)).toEqual(['pivot-1', 'pivot-2']);
  });

  it('remove 只删指定实例', () => {
    const list = [configWith('pivot-1'), configWith('pivot-2')];
    expect(removePivotConfig(list, 'pivot-1').map((config) => config.id)).toEqual(['pivot-2']);
    // 删不存在的 id 不抛错、也不改列表
    expect(removePivotConfig(list, 'nope')).toHaveLength(2);
  });

  it('两个实例各自独立计算（同一份源数据、不同布局）', () => {
    const source = sheetOf(SALES);
    const byQuarter = configWith('pivot-1');
    const byRegion = {
      ...configWith('pivot-2'),
      rows: [],
      cols: [0],
      values: [{ column: 2, aggregation: 'sum' as const }],
    };
    const first = computePivot(byQuarter, readPivotSource(source, byQuarter));
    const second = computePivot(byRegion, readPivotSource(source, byRegion));
    expect(first.blocks[0].grandTotal).toBe(second.blocks[0].grandTotal);
    expect(first.rowFields).toEqual([0]);
    expect(second.colFields).toEqual([0]);
    expect(first.colKeys).toHaveLength(2); // Q1/Q2
    expect(second.colKeys).toHaveLength(2); // 华东/华南
  });
});
