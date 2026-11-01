import { describe, expect, it } from 'vitest';
import {
  CHART_TYPES,
  buildChartOption,
  comboSeriesType,
  supportsSecondaryAxis,
  usesSecondaryAxis,
  type ChartData,
  type ChartType,
} from './charts';
import { buildChartXml, parseChartXml, splitSheetRef } from './chartXml';
import { chartTypeBreakdown, summarizeChartParts } from './chartImport';
import { resolveChart } from './charts';

/** P2-S8：散点 / 雷达 / 组合图的渲染 option、OOXML 导出与 chart part 回读 */

const DATA: ChartData = {
  categories: ['1', '2', '3'],
  rangeLabel: 'A1:B4',
  series: [
    { name: '销量', data: [10, 20, 30] },
    { name: '增长率', data: [0.1, 0.2, 0.3] },
  ],
};

const SNAPSHOT = {
  sheetOrder: ['s1'],
  sheets: {
    s1: {
      name: 'Data',
      cellData: {
        '0': { '0': { v: '类别' }, '1': { v: '销量' }, '2': { v: '增长率' } },
        '1': { '0': { v: 'Q1' }, '1': { v: 10 }, '2': { v: 0.1 } },
        '2': { '0': { v: 'Q2' }, '1': { v: 20 }, '2': { v: 0.2 } },
        '3': { '0': { v: 'Q3' }, '1': { v: 30 }, '2': { v: 0.3 } },
      },
    },
  },
};

describe('图表类型清单', () => {
  it('对外公布七种类型（SHEET-08 收口：柱线饼 + 散点/雷达/组合 + 面积）', () => {
    expect(CHART_TYPES).toEqual(['bar', 'line', 'area', 'pie', 'scatter', 'radar', 'combo']);
  });

  it('组合图只把最后一个系列画成折线', () => {
    expect(comboSeriesType(0, 2)).toBe('bar');
    expect(comboSeriesType(1, 2)).toBe('line');
    expect(comboSeriesType(0, 1)).toBe('bar');
  });

  it('次坐标轴只挂在最后一个系列，且至少两个系列才有意义', () => {
    expect(usesSecondaryAxis(true, 0, 2)).toBe(false);
    expect(usesSecondaryAxis(true, 1, 2)).toBe(true);
    expect(usesSecondaryAxis(undefined, 1, 2)).toBe(false);
    // 单系列全挪到次轴等于没双轴
    expect(usesSecondaryAxis(true, 0, 1)).toBe(false);
    expect(supportsSecondaryAxis('combo')).toBe(true);
    expect(supportsSecondaryAxis('area')).toBe(true);
    expect(supportsSecondaryAxis('pie')).toBe(false);
    expect(supportsSecondaryAxis('radar')).toBe(false);
  });
});

describe('ECharts option', () => {
  it('散点图用数值双轴，X 取分类列的数值', () => {
    const option = buildChartOption(DATA, 'scatter') as {
      xAxis: { type: string };
      series: { type: string; data: [number, number][] }[];
    };
    expect(option.xAxis.type).toBe('value');
    expect(option.series[0].type).toBe('scatter');
    expect(option.series[0].data[1]).toEqual([2, 20]);
  });

  it('雷达图把分类映射成指标，最大值取全系列绝对值', () => {
    const option = buildChartOption(DATA, 'radar') as {
      radar: { indicator: { name: string; max: number }[] };
      series: { type: string; data: { value: number[] }[] }[];
    };
    expect(option.radar.indicator.map((item) => item.name)).toEqual(['1', '2', '3']);
    expect(option.radar.indicator[0].max).toBe(30);
    expect(option.series[0].type).toBe('radar');
    expect(option.series[0].data[0].value).toEqual([10, 20, 30]);
  });

  it('组合图逐系列决定画法', () => {
    const option = buildChartOption(DATA, 'combo') as { series: { type: string }[] };
    expect(option.series.map((item) => item.type)).toEqual(['bar', 'line']);
  });

  it('面积图是"折线 + 面积填充"（ECharts 没有独立的 area 系列）', () => {
    const option = buildChartOption(DATA, 'area') as {
      series: { type: string; areaStyle?: { opacity: number } }[];
    };
    expect(option.series.map((item) => item.type)).toEqual(['line', 'line']);
    expect(option.series[0].areaStyle?.opacity).toBe(0.6);
  });

  it('双轴把最后一个系列挂到第二条数值轴', () => {
    const option = buildChartOption(DATA, 'bar', { secondary: true }) as {
      yAxis: unknown[];
      series: { yAxisIndex?: number }[];
    };
    expect(option.yAxis).toHaveLength(2);
    expect(option.series[0].yAxisIndex).toBeUndefined();
    expect(option.series[1].yAxisIndex).toBe(1);
  });

  it('只有单系列时不开双轴（避免空出左轴）', () => {
    const single: ChartData = { ...DATA, series: [DATA.series[0]] };
    const option = buildChartOption(single, 'bar', { secondary: true }) as { yAxis: unknown[] };
    expect(Array.isArray(option.yAxis)).toBe(false);
  });
});

describe('OOXML 导出', () => {
  const spec = resolveChart(SNAPSHOT, 's1', {
    startRow: 0,
    startColumn: 0,
    endRow: 3,
    endColumn: 2,
  });
  if (!spec.ok) throw new Error('spec setup failed');

  const xmlOf = (type: ChartType, secondary = false) =>
    buildChartXml(spec.value, type, 'Data', { secondary });

  it('散点图写 scatterChart + xVal/yVal（用 cat/val 会被 Excel 判为损坏）', () => {
    const xml = xmlOf('scatter');
    expect(xml).toContain('<c:scatterChart>');
    expect(xml).toContain('<c:xVal><c:numRef>');
    expect(xml).toContain('<c:yVal><c:numRef>');
    expect(xml).not.toContain('<c:cat>');
  });

  it('雷达图写 radarChart 并复用分类/数值轴', () => {
    const xml = xmlOf('radar');
    expect(xml).toContain('<c:radarChart>');
    expect(xml).toContain('<c:radarStyle val="marker"/>');
    expect(xml).toContain('<c:catAx>');
  });

  it('组合图拆成柱图组 + 折线图组，共用同一对 axId', () => {
    const xml = xmlOf('combo');
    expect(xml).toContain('<c:barChart>');
    expect(xml).toContain('<c:lineChart>');
    expect(xml.indexOf('<c:barChart>')).toBeLessThan(xml.indexOf('<c:lineChart>'));
    // 两组各引用一对轴 + 轴定义本身各带一个 = 6 处，但只有两个不同的 id
    const axIds = xml.match(/<c:axId val="\d+"\/>/g) ?? [];
    expect(axIds).toHaveLength(6);
    expect(new Set(axIds).size).toBe(2);
  });

  it('面积图写 areaChart，填充半透明', () => {
    const xml = xmlOf('area');
    expect(xml).toContain('<c:areaChart><c:grouping val="standard"/>');
    expect(xml).toContain('<a:alpha val="60000"/>');
    expect(xml).not.toContain('<c:barChart>');
    expect(xml).not.toContain('<c:lineChart>');
  });

  it('双轴 = 两组共用同一个分类轴 + 两条数值轴（次轴 axPos=r）', () => {
    const xml = xmlOf('bar', true);
    expect(xml.match(/<c:barChart>/g)).toHaveLength(2);
    // 分类轴只有一条，两个数值轴
    expect(xml.match(/<c:catAx>/g)).toHaveLength(1);
    expect(xml.match(/<c:valAx>/g)).toHaveLength(2);
    expect(xml).toContain('<c:axPos val="r"/>');
    expect(xml).toContain('<c:axId val="333333333"/>');
    expect(xml).toContain('<c:crosses val="max"/>');
  });

  it('组合图 + 双轴：柱留在主轴、折线走次轴', () => {
    const xml = xmlOf('combo', true);
    const barGroup = xml.slice(xml.indexOf('<c:barChart>'), xml.indexOf('</c:barChart>'));
    const lineGroup = xml.slice(xml.indexOf('<c:lineChart>'), xml.indexOf('</c:lineChart>'));
    expect(barGroup).toContain('val="222222222"');
    expect(barGroup).not.toContain('val="333333333"');
    expect(lineGroup).toContain('val="333333333"');
  });

  it('单系列时即使打开开关也不生成次轴', () => {
    const single = resolveChart(
      {
        sheetOrder: ['s1'],
        sheets: {
          s1: {
            name: 'Data',
            cellData: {
              '0': { '0': { v: '类别' }, '1': { v: '销量' } },
              '1': { '0': { v: 'Q1' }, '1': { v: 10 } },
              '2': { '0': { v: 'Q2' }, '1': { v: 20 } },
            },
          },
        },
      },
      's1',
      { startRow: 0, startColumn: 0, endRow: 2, endColumn: 1 },
    );
    if (!single.ok) throw new Error('single series setup failed');
    const xml = buildChartXml(single.value, 'bar', 'Data', { secondary: true });
    expect(xml.match(/<c:valAx>/g)).toHaveLength(1);
    expect(xml).not.toContain('333333333');
  });
});

describe('chart part 回读', () => {
  const spec = resolveChart(SNAPSHOT, 's1', {
    startRow: 0,
    startColumn: 0,
    endRow: 3,
    endColumn: 2,
  });
  if (!spec.ok) throw new Error('spec setup failed');

  it('六种类型都能读回类型、表名与引用', () => {
    for (const type of CHART_TYPES) {
      const parsed = parseChartXml(buildChartXml(spec.value, type, 'Data'));
      expect(parsed?.type).toBe(type);
      expect(parsed?.sheetName).toBe('Data');
      expect(parsed?.valueRefs).toHaveLength(2);
      expect(parsed?.categoryRef).toContain("'Data'!$A$2:$A$4");
    }
  });

  it('认不出的图（曲面图）返回 null，不猜', () => {
    expect(parseChartXml('<c:chartSpace><c:surfaceChart/></c:chartSpace>')).toBeNull();
  });

  it('表名去掉引号并还原双写单引号', () => {
    expect(splitSheetRef("'My ''Sheet'''!$A$1")).toEqual({
      sheetName: "My 'Sheet'",
      body: '$A$1',
    });
    expect(splitSheetRef('$A$1')).toEqual({ sheetName: null, body: '$A$1' });
  });

  it('统计保留的原生图表（含无法识别的）', () => {
    const spec2 = resolveChart(SNAPSHOT, 's1', {
      startRow: 0,
      startColumn: 0,
      endRow: 3,
      endColumn: 2,
    });
    if (!spec2.ok) throw new Error('spec setup failed');
    const encode = (xml: string) => Buffer.from(xml, 'utf8').toString('base64');
    const parts = {
      'xl/charts/chart1.xml': encode(buildChartXml(spec2.value, 'scatter', 'Data')),
      'xl/charts/chart2.xml': encode(buildChartXml(spec2.value, 'combo', 'Data')),
      'xl/charts/chart3.xml': encode('<c:chartSpace><c:surfaceChart/></c:chartSpace>'),
      'xl/charts/_rels/chart1.xml.rels': encode('<Relationships/>'),
    };
    const summary = summarizeChartParts(parts);
    expect(summary.total).toBe(3);
    expect(summary.unknown).toBe(1);
    expect(chartTypeBreakdown(summary)).toEqual([
      { type: 'scatter', count: 1 },
      { type: 'combo', count: 1 },
    ]);
  });
});
