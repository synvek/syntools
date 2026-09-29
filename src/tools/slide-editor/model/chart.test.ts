import { describe, expect, it } from 'vitest';
import {
  barGroupingOf,
  chartNameOf,
  isSingleSeriesChart,
  normalizeChartData,
  resizeChartCategories,
  resizeChartSeries,
  setChartLabel,
  setChartValue,
  themePalette,
} from './chart';
import { createChartElement, createDoc } from './factory';
import type { ChartElement } from './types';

describe('图表类型映射', () => {
  it('柱形图三种分组都映射到 pptxgenjs 的 bar', () => {
    expect(chartNameOf('bar')).toBe('bar');
    expect(chartNameOf('barStacked')).toBe('bar');
    expect(chartNameOf('barPercent')).toBe('bar');
    expect(barGroupingOf('bar')).toBe('clustered');
    expect(barGroupingOf('barStacked')).toBe('stacked');
    expect(barGroupingOf('barPercent')).toBe('percent');
  });

  it('非柱形图没有分组方式', () => {
    expect(chartNameOf('pie')).toBe('pie');
    expect(barGroupingOf('line')).toBeUndefined();
  });

  it('饼图与环形图是单系列图表', () => {
    expect(isSingleSeriesChart('pie')).toBe(true);
    expect(isSingleSeriesChart('doughnut')).toBe(true);
    expect(isSingleSeriesChart('bar')).toBe(false);
  });
});

describe('图表数据规范化', () => {
  it('空数据补出 1 类别 1 系列，避免渲染除零', () => {
    const result = normalizeChartData([], [], 'bar');
    expect(result.categories).toEqual(['1']);
    expect(result.series).toEqual([{ name: 'Series 1', values: [0] }]);
  });

  it('系列数值按类别数补齐与截断', () => {
    const result = normalizeChartData(
      ['A', 'B', 'C'],
      [
        { name: 'S1', values: [1] },
        { name: 'S2', values: [1, 2, 3, 4, 5] },
      ],
      'bar',
    );
    expect(result.series[0]!.values).toEqual([1, 0, 0]);
    expect(result.series[1]!.values).toEqual([1, 2, 3]);
  });

  it('非法数值归零而不是 NaN', () => {
    const result = normalizeChartData(['A'], [{ name: 'S', values: [Number.NaN] }], 'bar');
    expect(result.series[0]!.values).toEqual([0]);
  });

  it('饼图截断为单系列', () => {
    const result = normalizeChartData(
      ['A', 'B'],
      [
        { name: 'S1', values: [1, 2] },
        { name: 'S2', values: [3, 4] },
      ],
      'pie',
    );
    expect(result.series).toHaveLength(1);
  });
});

describe('图表编辑操作', () => {
  function chart(): ChartElement {
    return createChartElement(createDoc(), 'bar');
  }

  it('增减类别时同步裁剪/补齐数值', () => {
    const grown = resizeChartCategories(chart(), 5);
    expect(grown.categories).toHaveLength(5);
    expect(grown.series[0]!.values).toHaveLength(5);
    const shrunk = resizeChartCategories(grown, 2);
    expect(shrunk.series[0]!.values).toHaveLength(2);
  });

  it('增减系列时新系列填 0', () => {
    const grown = resizeChartSeries(chart(), 4);
    expect(grown.series).toHaveLength(4);
    expect(grown.series[3]!.values.every((value) => value === 0)).toBe(true);
  });

  it('改数值与改标签都推进 revision（渲染缓存失效）', () => {
    const before = chart();
    const valued = setChartValue(before, 1, 2, 99);
    expect(valued.series[1]!.values[2]).toBe(99);
    expect(valued.revision).toBe((before.revision ?? 0) + 1);

    const labelled = setChartLabel(valued, 'category', 0, 'Q1');
    expect(labelled.categories[0]).toBe('Q1');
    expect(labelled.revision).toBe((valued.revision ?? 0) + 1);

    const renamed = setChartLabel(labelled, 'series', 1, '营收');
    expect(renamed.series[1]!.name).toBe('营收');
  });
});

describe('主题配色', () => {
  it('取主题 accent 色，缺失时回落默认色板', () => {
    const palette = themePalette({ accent1: '#111111', accent2: '#222222' });
    expect(palette.slice(0, 2)).toEqual(['#111111', '#222222']);
    expect(themePalette(undefined).length).toBe(6);
    expect(themePalette({ accent1: 'not-a-color' }).length).toBe(6);
  });
});
