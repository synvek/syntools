import { describe, expect, it } from 'vitest';
import { buildChartData, buildChartOption, type ChartRange } from './charts';
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
