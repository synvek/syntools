import { describe, expect, it } from 'vitest';
import {
  buildChartData,
  buildChartOption,
  buildRangeLabel,
  parseRangeLabel,
  resolveChart,
  type ChartRange,
} from './charts';
import type { WorkbookSnapshotLite } from './core';

const range = (
  startRow: number,
  startColumn: number,
  endRow: number,
  endColumn: number,
): ChartRange => ({
  startRow,
  startColumn,
  endRow,
  endColumn,
});

const sheetOf = (
  cellData: Record<string, Record<string, { v?: unknown; f?: unknown }>>,
): WorkbookSnapshotLite => ({
  sheetOrder: ['s'],
  sheets: { s: { name: 'Sheet1', cellData } },
});

describe('buildChartData', () => {
  it('首列文本作分类、首行作系列名', () => {
    const snapshot = sheetOf({
      '0': { '0': { v: '月份' }, '1': { v: '销售' } },
      '1': { '0': { v: '一月' }, '1': { v: 10 } },
      '2': { '0': { v: '二月' }, '1': { v: 20 } },
    });
    const result = buildChartData(snapshot, 's', range(0, 0, 2, 1));
    expect(result).toEqual({
      ok: true,
      value: {
        categories: ['一月', '二月'],
        series: [{ name: '销售', data: [10, 20] }],
        rangeLabel: 'A1:B3',
      },
    });
  });

  it('无文本首列/首行时用列名与序号', () => {
    const snapshot = sheetOf({
      '0': { '0': { v: 1 }, '1': { v: 2 } },
      '1': { '0': { v: 3 }, '1': { v: 4 } },
    });
    const result = buildChartData(snapshot, 's', range(0, 0, 1, 1));
    expect(result).toEqual({
      ok: true,
      value: {
        categories: ['1', '2'],
        series: [
          { name: 'A', data: [1, 3] },
          { name: 'B', data: [2, 4] },
        ],
        rangeLabel: 'A1:B2',
      },
    });
  });

  it('非数值单元格为 null，且整列为空的系列被剔除', () => {
    const snapshot = sheetOf({
      '0': { '0': { v: '' }, '1': { v: '数值' }, '2': { v: '文本列' } },
      '1': { '0': { v: '行一' }, '1': { v: 5 }, '2': { v: 'abc' } },
    });
    const result = buildChartData(snapshot, 's', range(0, 0, 1, 2));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.categories).toEqual(['行一']);
    expect(result.value.series).toEqual([{ name: '数值', data: [5] }]);
  });

  it('文本形式数字按数值处理，公式无缓存值为 null', () => {
    const snapshot = sheetOf({
      '0': { '0': { v: 'A' }, '1': { v: 'B' } },
      '1': { '0': { v: 'x' }, '1': { v: '12.5' } },
      '2': { '0': { v: 'y' }, '1': { f: '=SUM(B1:B1)' } },
    });
    const result = buildChartData(snapshot, 's', range(0, 0, 2, 1));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.series[0].data).toEqual([12.5, null]);
  });

  it('范围反转时自动归一', () => {
    const snapshot = sheetOf({
      '0': { '0': { v: 1 }, '1': { v: 2 } },
      '1': { '0': { v: 3 }, '1': { v: 4 } },
    });
    const forward = buildChartData(snapshot, 's', range(0, 0, 1, 1));
    const reversed = buildChartData(snapshot, 's', range(1, 1, 0, 0));
    expect(reversed).toEqual(forward);
  });

  it('数据不足或全是空值返回 EMPTY', () => {
    expect(buildChartData(sheetOf({ '0': { '0': { v: 1 } } }), 's', range(0, 0, 0, 0))).toEqual({
      ok: false,
      error: 'EMPTY',
    });
    const allText = sheetOf({
      '0': { '0': { v: 'a' } },
      '1': { '0': { v: 'b' } },
    });
    expect(buildChartData(allText, 's', range(0, 0, 1, 0))).toEqual({ ok: false, error: 'EMPTY' });
    expect(buildChartData({}, null, range(0, 0, 1, 1))).toEqual({ ok: false, error: 'EMPTY' });
  });
});

describe('resolveChart（值 + 引用）', () => {
  it('表头行 + 文本首列：引用指向表头与数据列（导出原生图表用）', () => {
    const snapshot = sheetOf({
      '0': { '0': { v: '月份' }, '1': { v: '销售' } },
      '1': { '0': { v: '一月' }, '1': { v: 10 } },
      '2': { '0': { v: '二月' }, '1': { v: 20 } },
    });
    const result = resolveChart(snapshot, 's', range(0, 0, 2, 1));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const spec = result.value;
    expect(spec.categories).toEqual(['一月', '二月']);
    expect(spec.categoryColumn).toBe(0);
    expect(spec.categoryStartRow).toBe(1);
    expect(spec.categoryEndRow).toBe(2);
    expect(spec.series).toEqual([
      {
        name: '销售',
        nameCell: { row: 0, column: 1 },
        column: 1,
        startRow: 1,
        endRow: 2,
        data: [10, 20],
      },
    ]);
  });

  it('无文本首列 / 首行时无分类引用与系列名单元格', () => {
    const snapshot = sheetOf({
      '0': { '0': { v: 1 }, '1': { v: 2 } },
      '1': { '0': { v: 3 }, '1': { v: 4 } },
    });
    const result = resolveChart(snapshot, 's', range(0, 0, 1, 1));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.categoryColumn).toBeNull();
    expect(result.value.series.map((item) => item.name)).toEqual(['A', 'B']);
    expect(result.value.series.every((item) => item.nameCell === null)).toBe(true);
    expect(result.value.series[0]).toMatchObject({
      column: 0,
      startRow: 0,
      endRow: 1,
      data: [1, 3],
    });
  });

  it('与 buildChartData 共用同一套判定（值完全一致）', () => {
    const snapshot = sheetOf({
      '0': { '0': { v: 'Month' }, '1': { v: 'Qty' }, '2': { v: 'Note' } },
      '1': { '0': { v: 'Jan' }, '1': { v: 10 }, '2': { v: 'x' } },
      '2': { '0': { v: 'Feb' }, '1': { v: 20 }, '2': { v: 'y' } },
    });
    const spec = resolveChart(snapshot, 's', range(0, 0, 2, 2));
    const data = buildChartData(snapshot, 's', range(0, 0, 2, 2));
    expect(spec.ok && data.ok).toBe(true);
    if (!spec.ok || !data.ok) return;
    expect(data.value.categories).toEqual(spec.value.categories);
    expect(data.value.series).toEqual(
      spec.value.series.map((item) => ({ name: item.name, data: item.data })),
    );
    expect(data.value.rangeLabel).toBe(spec.value.rangeLabel);
  });

  it('区域无数据时返回 EMPTY（与 buildChartData 一致）', () => {
    expect(resolveChart(sheetOf({ '0': { '0': { v: 1 } } }), 's', range(0, 0, 0, 0))).toEqual({
      ok: false,
      error: 'EMPTY',
    });
  });
});

describe('数据区域标签', () => {
  it('区域 → A1 记法', () => {
    expect(buildRangeLabel({ startRow: 0, startColumn: 0, endRow: 9, endColumn: 2 })).toBe(
      'A1:C10',
    );
    // 反转区域先归一
    expect(buildRangeLabel({ startRow: 2, startColumn: 1, endRow: 0, endColumn: 0 })).toBe('A1:B3');
  });

  it('A1 记法 → 区域（含单格与非法输入）', () => {
    expect(parseRangeLabel('A1:C10')).toEqual({
      startRow: 0,
      startColumn: 0,
      endRow: 9,
      endColumn: 2,
    });
    expect(parseRangeLabel(' B3 ')).toEqual({
      startRow: 2,
      startColumn: 1,
      endRow: 2,
      endColumn: 1,
    });
    expect(parseRangeLabel('C10:A1')).toEqual({
      startRow: 0,
      startColumn: 0,
      endRow: 9,
      endColumn: 2,
    });
    expect(parseRangeLabel('hello')).toBeNull();
    expect(parseRangeLabel('')).toBeNull();
  });

  it('标签与解析可往返', () => {
    const range = { startRow: 1, startColumn: 2, endRow: 5, endColumn: 7 };
    expect(parseRangeLabel(buildRangeLabel(range))).toEqual(range);
  });
});

describe('buildChartOption', () => {
  const data = {
    categories: ['一', '二'],
    series: [{ name: 'S', data: [1, 2] as (number | null)[] }],
    rangeLabel: 'A1:B3',
  };

  it('柱状 / 折线使用分类轴与多系列', () => {
    const bar = buildChartOption(data, 'bar') as { series: { type: string }[] };
    expect(bar.series[0].type).toBe('bar');
    const line = buildChartOption(data, 'line') as { series: { type: string; smooth?: boolean }[] };
    expect(line.series[0]).toMatchObject({ type: 'line', smooth: true });
  });

  it('饼图按第一个系列的分类切片', () => {
    const pie = buildChartOption(data, 'pie') as {
      series: { type: string; data: { name: string; value: number | null }[] }[];
    };
    expect(pie.series[0].type).toBe('pie');
    expect(pie.series[0].data).toEqual([
      { name: '一', value: 1 },
      { name: '二', value: 2 },
    ]);
  });
});
