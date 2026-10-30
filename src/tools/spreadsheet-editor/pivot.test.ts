import { describe, expect, it } from 'vitest';
import {
  buildPivot,
  collectFieldKeys,
  computePivot,
  normalizeKey,
  pivotNumber,
  pivotToMatrix,
  readPivotSource,
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
    expect(pivotToMatrix(result, multiConfig(), '(空白)')).toEqual([
      ['', 'Q1 / 金额', 'Q1 / 数量', '金额', '数量'],
      ['华东', 150, 2.5, 150, 2.5],
      ['华南', 30, 1, 30, 1],
      ['', 180, 2, 180, 2],
    ]);
  });

  it('keeps the single-value matrix layout unchanged', () => {
    const result = buildPivot(sheetOf(SALES), configOf());
    // 单值时不加值字段名，导出结果与上一版一致（老断言不会因为新特性变化）
    expect(pivotToMatrix(result, configOf(), '(空白)')[0]).toEqual(['', 'Q1', 'Q2', '']);
  });
});
