import type { ChartElement, ChartType } from './types';

/**
 * Chart data normalization.
 *
 * Pure functions (no Konva / echarts dependency), shared by three call sites:
 * - import: pads the raw categories/series parsed from `c:chart` into the shape the model expects;
 * - property panel: keeps categories and series the same length while editing rows/columns;
 * - export: ChartType → pptxgenjs chart name.
 */

/**
 * All supported chart types (order = display order in the insert panel).
 *
 * `labelKey` is the suffix of an i18n key under `tools.slide.*`, with copy for all 9 languages;
 * display text is not hardcoded here, otherwise English UIs would show Chinese labels.
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

/** ChartType → pptxgenjs CHART_NAME (looked up on export to avoid scattered strings) */
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

/** Bar grouping (pptxgenjs `barGrouping`) */
export function barGroupingOf(type: ChartType): string | undefined {
  if (type === 'barStacked') return 'stacked';
  if (type === 'barPercent') return 'percent';
  if (type === 'bar') return 'clustered';
  return undefined;
}

/** Pie/doughnut charts only use the first series */
export function isSingleSeriesChart(type: ChartType): boolean {
  return type === 'pie' || type === 'doughnut';
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Normalize chart data:
 * - guarantee at least 1 category and 1 series (empty data still renders safely);
 * - pad each series to the category count (missing values become 0, extras are truncated);
 * - truncate pie charts to one series (OOXML pie charts express only a single series too).
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

/** Resize the category count: trims or pads each series' values accordingly */
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

/** Resize the series count: trim or pad (new series filled with 0) */
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

/** Update a single value */
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

/** Rename a category / series */
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

/** Theme accent colors as the chart's default palette (matching the Office theme colors) */
export function themePalette(colors: Record<string, string> | undefined): string[] {
  const keys = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
  const picked = keys
    .map((key) => colors?.[key] ?? '')
    .filter((value) => /^#[0-9a-fA-F]{6}$/.test(value));
  return picked.length > 0
    ? picked
    : ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];
}
