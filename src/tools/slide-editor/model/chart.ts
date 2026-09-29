import type { ChartElement, ChartType } from './types';

/**
 * 图表数据规范化。
 *
 * 纯函数（不依赖 Konva / echarts），供三处共用：
 * - 导入：把 `c:chart` 解析出的原始类别/系列补齐成模型要求的形状；
 * - 属性面板：编辑行列时保持 categories 与 series 长度对齐；
 * - 导出：ChartType → pptxgenjs 图表名。
 */

/**
 * 所有受支持的图表类型（顺序即插入面板展示顺序）。
 *
 * `labelKey` 是 `tools.slide.*` 下的 i18n 键后缀，9 种语言都有对应文案；
 * 这里不写死展示文案，否则英文界面里会出现中文标签。
 */
export const CHART_TYPES: { id: ChartType; labelKey: string }[] = [
  { id: 'bar', labelKey: 'chartBar' },
  { id: 'barStacked', labelKey: 'chartBarStacked' },
  { id: 'barPercent', labelKey: 'chartBarPercent' },
  { id: 'line', labelKey: 'chartLine' },
  { id: 'area', labelKey: 'chartArea' },
  { id: 'pie', labelKey: 'chartPie' },
  { id: 'doughnut', labelKey: 'chartDoughnut' },
  { id: 'scatter', labelKey: 'chartScatter' },
  { id: 'radar', labelKey: 'chartRadar' },
];

/** ChartType → pptxgenjs 的 CHART_NAME（导出侧查表，避免散落字符串） */
export function chartNameOf(type: ChartType): string {
  switch (type) {
    case 'bar':
    case 'barStacked':
    case 'barPercent':
      return 'bar';
    case 'line':
      return 'line';
    case 'area':
      return 'area';
    case 'pie':
      return 'pie';
    case 'doughnut':
      return 'doughnut';
    case 'scatter':
      return 'scatter';
    case 'radar':
      return 'radar';
    default:
      return 'bar';
  }
}

/** 柱形图分组方式（pptxgenjs 的 barGrouping） */
export function barGroupingOf(type: ChartType): string | undefined {
  if (type === 'barStacked') return 'stacked';
  if (type === 'barPercent') return 'percent';
  if (type === 'bar') return 'clustered';
  return undefined;
}

/** 饼图/环形图只取第一个系列 */
export function isSingleSeriesChart(type: ChartType): boolean {
  return type === 'pie' || type === 'doughnut';
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 规范化图表数据：
 * - 保证至少 1 个类别与 1 个系列（空数据也能安全渲染）；
 * - 每个系列的数值长度补齐到类别数（缺的补 0，多的截断）；
 * - 饼图系列超过 1 个时截断（OOXML 饼图也只表达单系列）。
 */
export function normalizeChartData(
  categories: string[],
  series: { name: string; values: number[] }[],
  type: ChartType,
): { categories: string[]; series: { name: string; values: number[] }[] } {
  const cats = categories.length > 0 ? categories : ['1'];
  const width = cats.length;
  let list = series.length > 0 ? series : [{ name: 'Series 1', values: cats.map(() => 0) }];
  if (isSingleSeriesChart(type)) list = list.slice(0, 1);
  return {
    categories: cats,
    series: list.map((item, index) => ({
      name: item.name || `Series ${index + 1}`,
      values: Array.from({ length: width }, (_, i) => toNumber(item.values[i])),
    })),
  };
}

/** 调整类别数量：同步裁剪/补齐每个系列的数值长度 */
export function resizeChartCategories(element: ChartElement, count: number): ChartElement {
  const size = Math.max(1, Math.round(count));
  const categories = Array.from(
    { length: size },
    (_, index) => element.categories[index] ?? String(index + 1),
  );
  return {
    ...element,
    categories,
    series: element.series.map((series) => ({
      ...series,
      values: Array.from({ length: size }, (_, index) => series.values[index] ?? 0),
    })),
    revision: (element.revision ?? 0) + 1,
  };
}

/** 调整系列数量：裁剪或补齐（新系列填 0） */
export function resizeChartSeries(element: ChartElement, count: number): ChartElement {
  const size = Math.max(1, Math.round(count));
  const width = Math.max(1, element.categories.length);
  const series = Array.from({ length: size }, (_, index) => {
    const existing = element.series[index];
    if (existing) return existing;
    return { name: `Series ${index + 1}`, values: Array.from({ length: width }, () => 0) };
  });
  return { ...element, series, revision: (element.revision ?? 0) + 1 };
}

/** 修改单个数值 */
export function setChartValue(
  element: ChartElement,
  seriesIndex: number,
  categoryIndex: number,
  value: number,
): ChartElement {
  return {
    ...element,
    series: element.series.map((series, index) =>
      index === seriesIndex
        ? {
            ...series,
            values: series.values.map((current, i) => (i === categoryIndex ? value : current)),
          }
        : series,
    ),
    revision: (element.revision ?? 0) + 1,
  };
}

/** 修改类别名 / 系列名 */
export function setChartLabel(
  element: ChartElement,
  kind: 'category' | 'series',
  index: number,
  label: string,
): ChartElement {
  if (kind === 'category') {
    return {
      ...element,
      categories: element.categories.map((value, i) => (i === index ? label : value)),
      revision: (element.revision ?? 0) + 1,
    };
  }
  return {
    ...element,
    series: element.series.map((series, i) => (i === index ? { ...series, name: label } : series)),
    revision: (element.revision ?? 0) + 1,
  };
}

/** 主题 accent 色作为图表默认配色（与 Office 主题色板一致） */
export function themePalette(colors: Record<string, string> | undefined): string[] {
  const keys = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
  const picked = keys
    .map((key) => colors?.[key] ?? '')
    .filter((value) => /^#[0-9a-fA-F]{6}$/.test(value));
  return picked.length > 0
    ? picked
    : ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];
}
