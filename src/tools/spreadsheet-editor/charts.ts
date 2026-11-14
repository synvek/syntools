import type { ToolResult } from '@/core/types';
import { columnIndexToName, parseCellRef, type WorkbookSnapshotLite } from './core';

/**
 * Chart pure-logic layer: turns a sheet cell range into "categories + series", then into an ECharts
 * option. No dependency on the echarts runtime, so it can be unit tested in isolation.
 */

export interface ChartRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

export interface ChartSeries {
  name: string;
  /** One entry per category; blank / non-numeric values are null (the line breaks instead of dropping to 0) */
  data: (number | null)[];
}

export interface ChartData {
  categories: string[];
  series: ChartSeries[];
  /** Data range label (e.g. A1:C10), used as the panel title */
  rangeLabel: string;
}

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'radar' | 'combo';

/**
 * P2-S8 扩展后的图表类型。`combo`（组合图）沿用同一个 `range`：
 * 除最后一个系列外都画柱，最后一个系列画折线 —— "销量 + 增长率" 是最常见的用法。
 * 双轴不再藏在类型里，而是 `ChartConfig.secondary` 一个开关（见 `usesSecondaryAxis`）。
 */
export const CHART_TYPES: ChartType[] = ['bar', 'line', 'area', 'pie', 'scatter', 'radar', 'combo'];

/** 类型 → 文案 key（面板按钮与导入统计共用一份，避免两处各写一遍） */
export const CHART_TYPE_LABEL_KEY: Record<ChartType, string> = {
  bar: 'chartBar',
  line: 'chartLine',
  area: 'chartArea',
  pie: 'chartPie',
  scatter: 'chartScatter',
  radar: 'chartRadar',
  combo: 'chartCombo',
};

/** 组合图里每个系列的画法：最后一个系列用折线，其余柱状 */
export function comboSeriesType(index: number, total: number): 'bar' | 'line' {
  return total > 1 && index === total - 1 ? 'line' : 'bar';
}

/** 分类轴图上单个系列的画法（饼/散点/雷达不参与） */
export type SeriesRenderKind = 'bar' | 'line' | 'area';

/**
 * 类型 + 系列序号 → 画法。除组合图外整张图一种画法，所以这里只有组合图需要看序号。
 * ECharts 与 OOXML 两侧都走这个函数，避免"应用里画的"和"Excel 里看到的"不一致。
 */
export function seriesRenderKind(type: ChartType, index: number, total: number): SeriesRenderKind {
  if (type === 'combo') return comboSeriesType(index, total);
  if (type === 'line') return 'line';
  if (type === 'area') return 'area';
  return 'bar';
}

/** 饼图 / 散点图 / 雷达图没有"第二条数值轴"的语义，不提供次坐标轴开关 */
export function supportsSecondaryAxis(type: ChartType): boolean {
  return type === 'bar' || type === 'line' || type === 'area' || type === 'combo';
}

/**
 * 轴标题只对"分类轴 + 数值轴"的图有意义：饼图没有轴，雷达图的"轴"是各指标名（本身已是标题），
 * 两者都不提供轴标题输入，导出侧也不写。
 */
export function supportsAxisTitles(type: ChartType): boolean {
  return type !== 'pie' && type !== 'radar';
}

/**
 * 次坐标轴挂在"最后一个系列"上 —— 与组合图"最后一列画折线"是同一条规则
 * （"销量 + 增长率" 里增长率走次轴），配置只留开/关，不再暴露一个系列索引。
 * 只有一个系列时开关没有意义（全部挪到次轴等于没双轴），此时返回 false。
 */
export function usesSecondaryAxis(
  secondary: boolean | undefined,
  index: number,
  total: number,
): boolean {
  return secondary === true && total > 1 && index === total - 1;
}

/** 图例位置；`none` = 不显示图例（Excel 里就是"没有 legend 元素"） */
export type ChartLegendPosition = 'none' | 'top' | 'right' | 'bottom' | 'left';

/** 顺序即面板里的顺序 */
export const CHART_LEGEND_POSITIONS: ChartLegendPosition[] = [
  'none',
  'top',
  'right',
  'bottom',
  'left',
];

/** 位置 → 文案 key（面板与测试共用，避免两处各写一遍） */
export const CHART_LEGEND_LABEL_KEY: Record<ChartLegendPosition, string> = {
  none: 'chartLegendNone',
  top: 'chartLegendTop',
  right: 'chartLegendRight',
  bottom: 'chartLegendBottom',
  left: 'chartLegendLeft',
};

/**
 * 标题类文本的归一化：`undefined` / 空串 / 纯空格都表示"没有"。
 *
 * 为什么要区分"没有"与"空标题"：Excel 里 `<c:title>` 存在但文字为空 → 图表上方一个空框，
 * 用户看不出怎么去掉。所以留空一律不写 title，而不是写一个空 title。
 */
export function chartText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text ? text : undefined;
}

/**
 * Persisted config for an in-sheet chart.
 * Geometry is in pixels relative to the sheet area and is saved with the snapshot (see syntoolsCharts
 * in xlsx-io).
 *
 * P1-8 的格式化字段全部是可选的，缺省即 Excel 的默认外观（无标题 / 图例在底部 / 无数据标签 /
 * 有网格线）。这样老快照读进来不需要迁移，导出结果也不会因为多了几个字段而变化。
 */
export interface ChartConfig {
  id: string;
  type: ChartType;
  /** Data range (0-based inclusive) */
  range: ChartRange;
  /** Sheet the chart belongs to: it keeps reading that sheet and only shows on it after a sheet switch */
  sheetId?: string;
  /** 最后一个系列走次坐标轴（右轴）；仅对柱/线/面积/组合图有效，见 `usesSecondaryAxis` */
  secondary?: boolean;
  /** 图表标题；缺省 = 无标题（空串同样视为无标题，见 `chartText`） */
  title?: string;
  /** 图例位置；缺省 = 底部（Excel 默认） */
  legend?: ChartLegendPosition;
  /** 轴标题；饼图 / 雷达图没有分类轴，写了也不画 */
  axisTitles?: { x?: string; y?: string };
  /** 数值标签；缺省 = 不显示（饼图例外：默认显示分类名，见 `buildChartOption`） */
  dataLabels?: boolean;
  /** 数值轴网格线；缺省 = 显示（Excel 默认） */
  showGridlines?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Range → A1 notation ("A1:C10") */
export function buildRangeLabel(range: ChartRange): string {
  const startRow = Math.min(range.startRow, range.endRow);
  const endRow = Math.max(range.startRow, range.endRow);
  const startColumn = Math.min(range.startColumn, range.endColumn);
  const endColumn = Math.max(range.startColumn, range.endColumn);
  return `${columnIndexToName(startColumn)}${startRow + 1}:${columnIndexToName(endColumn)}${
    endRow + 1
  }`;
}

/** A1 notation → range; null when invalid (a single cell "A1" is treated as 1×1) */
export function parseRangeLabel(label: string): ChartRange | null {
  const text = label.trim();
  if (!text) return null;
  const [startRef, endRef] = text.split(':');
  const start = parseCellRef(startRef ?? '');
  const end = parseCellRef(endRef ?? startRef ?? '');
  if (!start || !end) return null;
  return {
    startRow: Math.min(start.row, end.row),
    startColumn: Math.min(start.column, end.column),
    endRow: Math.max(start.row, end.row),
    endColumn: Math.max(start.column, end.column),
  };
}

type LiteCell = { v?: unknown; f?: unknown } | undefined;

/** Cell value → number; numeric strings are accepted, anything else returns null */
function toNumber(value: unknown): number | null {
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

function toText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return '';
  return String(value);
}

/** A series' "reference" info (used when exporting a native .xlsx chart; rows/columns are 0-based absolute) */
export interface ChartSeriesRef {
  name: string;
  /** Cell holding the series name; null without a header row (the export then uses the literal name) */
  nameCell: { row: number; column: number } | null;
  /** Value column (0-based absolute index) */
  column: number;
  startRow: number;
  endRow: number;
  data: (number | null)[];
}

/**
 * Resolved chart structure: carries both the values (for in-app ECharts rendering and export caches)
 * and the references (the data source for native Excel charts). Both come from the same resolution,
 * so what the app draws and what Excel receives can never diverge.
 */
export interface ChartSpec {
  categories: string[];
  /** Category column (0-based absolute index); null means no category column (Excel uses 1..N) */
  categoryColumn: number | null;
  categoryStartRow: number;
  categoryEndRow: number;
  series: ChartSeriesRef[];
  rangeLabel: string;
}

/**
 * Cell range → chart structure (values + references).
 *
 * Conventions (same as common spreadsheet apps):
 * - if the first column is text, it becomes the category axis; otherwise categories are 1..N;
 * - if the first row of the value columns is text, it becomes the series names and data starts on
 *   the second row.
 */
export interface ResolveChartOptions {
  /**
   * 图表类型。散点图的 X 列是数值，靠"首列有没有文字"判断不出分类列，
   * 所以由类型直接指定首列为分类/X 列（导入回读的散点图依赖这条，否则 X 会被当成第二个系列）。
   */
  type?: ChartType;
}

export function resolveChart(
  snapshot: WorkbookSnapshotLite,
  sheetId: string | null,
  range: ChartRange,
  options: ResolveChartOptions = {},
): ToolResult<ChartSpec> {
  const order = snapshot.sheetOrder ?? [];
  const target = sheetId && snapshot.sheets?.[sheetId] ? sheetId : order[0];
  const sheet = target ? snapshot.sheets?.[target] : undefined;
  if (!sheet) return { ok: false, error: 'EMPTY' };

  const startRow = Math.max(0, Math.min(range.startRow, range.endRow));
  const endRow = Math.max(range.startRow, range.endRow);
  const startColumn = Math.max(0, Math.min(range.startColumn, range.endColumn));
  const endColumn = Math.max(range.startColumn, range.endColumn);

  const rows: { text: string; num: number | null }[][] = [];
  for (let row = startRow; row <= endRow; row += 1) {
    const line: { text: string; num: number | null }[] = [];
    for (let column = startColumn; column <= endColumn; column += 1) {
      const cell = sheet.cellData?.[String(row)]?.[String(column)] as LiteCell;
      const value = cell?.v;
      line.push({ text: toText(value), num: toNumber(value) });
    }
    rows.push(line);
  }
  if (rows.length < 2) return { ok: false, error: 'EMPTY' };

  const columnCount = rows[0].length;
  // Whether the first column is the category axis (non-numeric text exists below the first row);
  // 散点图的 X 列本身就是数字，只能按类型直接认定（见 ResolveChartOptions.type）
  const firstColumnIsText =
    options.type === 'scatter' ||
    rows.slice(1).some((line) => line[0].num === null && line[0].text !== '');
  const valueStart = firstColumnIsText ? 1 : 0;
  if (valueStart >= columnCount) return { ok: false, error: 'EMPTY' };

  // Whether the first row of the value columns is a header
  const hasHeaderRow = rows[0]
    .slice(valueStart)
    .some((cell) => cell.num === null && cell.text !== '');
  const dataStart = hasHeaderRow ? 1 : 0;
  const dataRows = rows.slice(dataStart);
  if (dataRows.length === 0) return { ok: false, error: 'EMPTY' };

  const categories = dataRows.map((line, index) => {
    if (!firstColumnIsText) return String(index + 1);
    return line[0].text || String(index + 1);
  });

  const series: ChartSeriesRef[] = [];
  for (let column = valueStart; column < columnCount; column += 1) {
    const absoluteColumn = startColumn + column;
    const fallback = columnIndexToName(absoluteColumn);
    series.push({
      name: hasHeaderRow ? rows[0][column].text || fallback : fallback,
      nameCell: hasHeaderRow ? { row: startRow, column: absoluteColumn } : null,
      column: absoluteColumn,
      startRow: startRow + dataStart,
      endRow,
      data: dataRows.map((line) => line[column].num),
    });
  }
  // Series whose column is entirely empty are dropped
  const usable = series.filter((item) => item.data.some((value) => value !== null));
  if (usable.length === 0) return { ok: false, error: 'EMPTY' };

  return {
    ok: true,
    value: {
      categories,
      categoryColumn: firstColumnIsText ? startColumn : null,
      categoryStartRow: startRow + dataStart,
      categoryEndRow: endRow,
      series: usable,
      rangeLabel: buildRangeLabel({ startRow, startColumn, endRow, endColumn }),
    },
  };
}

/** Range → chart data (for in-app rendering; shares the resolution logic with resolveChart) */
export function buildChartData(
  snapshot: WorkbookSnapshotLite,
  sheetId: string | null,
  range: ChartRange,
  type?: ChartType,
): ToolResult<ChartData> {
  const resolved = resolveChart(snapshot, sheetId, range, { type });
  if (!resolved.ok) return resolved;
  const spec = resolved.value;
  return {
    ok: true,
    value: {
      categories: spec.categories,
      series: spec.series.map((item): ChartSeries => ({ name: item.name, data: item.data })),
      rangeLabel: spec.rangeLabel,
    },
  };
}

export interface ChartOptionOptions {
  /** 最后一个系列走次坐标轴（右轴），与 OOXML 侧的 `buildChartXml(..., { secondary })` 一一对应 */
  secondary?: boolean;
  /** 以下 5 项与 `ChartXmlOptions` 同名同义：应用内画的和导出的必须一致（P1-8） */
  title?: string;
  legend?: ChartLegendPosition;
  axisTitles?: { x?: string; y?: string };
  dataLabels?: boolean;
  showGridlines?: boolean;
}

/** 图例位置 → ECharts 的 legend 配置；`none` 是显式隐藏而不是"留空" */
function legendOption(position: ChartLegendPosition | undefined): Record<string, unknown> {
  switch (position) {
    case 'none':
      return { show: false };
    case 'top':
      return { top: 0, type: 'scroll' };
    case 'left':
      return { left: 0, top: 'middle', orient: 'vertical', type: 'scroll' };
    case 'right':
      return { right: 0, top: 'middle', orient: 'vertical', type: 'scroll' };
    case 'bottom':
    default:
      return { bottom: 0, type: 'scroll' };
  }
}

/** 轴标题（ECharts 用 `name` + 居中的 nameLocation 表达） */
function axisName(text: string | undefined, gap: number): Record<string, unknown> {
  return text ? { name: text, nameLocation: 'middle', nameGap: gap } : {};
}

/**
 * Build an ECharts option (a pie slices the first series by category; the rest use a category axis with multiple series)
 *
 * P1-8：标题 / 图例 / 轴标题 / 数据标签 / 网格线全部从这里进 ECharts，
 * 与 `chartXml.ts` 的导出侧共用同一份配置，避免"应用里看着有标题、导出后没有"。
 */
export function buildChartOption(
  data: ChartData,
  type: ChartType,
  options: ChartOptionOptions = {},
): Record<string, unknown> {
  const title = chartText(options.title);
  const legend = legendOption(options.legend);
  // 标题与图例都占位置：不留出来就会压在图上
  const top = 24 + (title ? 18 : 0) + (options.legend === 'top' ? 18 : 0);
  const bottom = options.legend === 'none' ? 28 : 44;
  const gridlines = options.showGridlines !== false;
  const titleOption = title
    ? { show: true, text: title, left: 'center', top: 4, textStyle: { fontSize: 13 } }
    : {};

  if (type === 'pie') {
    const first = data.series[0];
    return {
      ...(title ? { title: titleOption } : {}),
      tooltip: { trigger: 'item' },
      legend,
      series: [
        {
          type: 'pie',
          radius: ['34%', '64%'],
          data: data.categories.map((name, index) => ({
            name,
            value: first?.data[index] ?? null,
          })),
          // 饼图默认显示"分类: 数值"，关掉数据标签时整块隐藏（与 OOXML 的 dLbls 一致）
          label: { show: options.dataLabels !== false, formatter: '{b}: {c}' },
        },
      ],
    };
  }
  if (type === 'radar') {
    // 雷达图把"分类"当指标轴：每个指标的最大值取所有系列里的最大绝对值，否则图形会溢出/缩成一点
    const max = Math.max(
      1,
      ...data.series.flatMap((item) => item.data.map((value) => Math.abs(value ?? 0))),
    );
    return {
      ...(title ? { title: titleOption } : {}),
      tooltip: { trigger: 'item' },
      legend,
      // 雷达图没有分类轴 / 数值轴，轴标题无处可放（导出侧同理，不写 axis title）
      radar: {
        indicator: data.categories.map((name) => ({ name, max })),
        radius: '62%',
      },
      series: [
        {
          type: 'radar',
          data: data.series.map((item) => ({
            name: item.name,
            value: item.data.map((value) => value ?? 0),
          })),
          ...(options.dataLabels ? { label: { show: true } } : {}),
        },
      ],
    };
  }

  if (type === 'scatter') {
    // X 轴取分类列的数值；分类是文字时退化为序号 1..N（与 OOXML 的散点图口径一致）
    const xs = data.categories.map((label, index) => {
      const parsed = Number(String(label).replace(/[,%\s]/g, ''));
      return Number.isFinite(parsed) && String(label).trim() !== '' ? parsed : index + 1;
    });
    return {
      ...(title ? { title: titleOption } : {}),
      tooltip: { trigger: 'item' },
      legend,
      grid: { left: 12, right: 20, top, bottom, containLabel: true },
      xAxis: {
        type: 'value',
        splitLine: { show: gridlines },
        ...axisName(chartText(options.axisTitles?.x), 28),
      },
      yAxis: {
        type: 'value',
        splitLine: { show: gridlines },
        ...axisName(chartText(options.axisTitles?.y), 40),
      },
      series: data.series.map((item) => ({
        name: item.name,
        type: 'scatter',
        symbolSize: 8,
        ...(options.dataLabels ? { label: { show: true } } : {}),
        data: item.data
          .map((value, index) => (value === null ? null : [xs[index], value]))
          .filter((point): point is [number, number] => point !== null),
      })),
    };
  }

  const total = data.series.length;
  // 双轴：主/次各一条数值轴，只有最后一个系列挂到右轴（与 OOXML 的组划分同一规则）
  const dual = options.secondary === true && total > 1 && supportsSecondaryAxis(type);
  const valueAxis = {
    type: 'value',
    splitLine: { show: gridlines },
    ...axisName(chartText(options.axisTitles?.y), dual ? 48 : 40),
  };
  return {
    ...(title ? { title: titleOption } : {}),
    tooltip: { trigger: 'axis' },
    legend,
    grid: {
      left: 12,
      right: dual ? 48 : 20,
      top,
      bottom,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.categories,
      ...axisName(chartText(options.axisTitles?.x), 28),
    },
    yAxis: dual ? [valueAxis, { type: 'value', splitLine: { show: false } }] : valueAxis,
    series: data.series.map((item, index) => {
      const kind = seriesRenderKind(type, index, total);
      // 面积图在 ECharts 里是"折线 + 面积填充"，没有独立的 area 系列类型
      const echartsType = kind === 'area' ? 'line' : kind;
      return {
        name: item.name,
        type: echartsType,
        data: item.data,
        ...(kind === 'line' ? { smooth: true } : {}),
        ...(kind === 'area' ? { areaStyle: { opacity: 0.6 } } : {}),
        ...(options.dataLabels ? { label: { show: true } } : {}),
        ...(dual && usesSecondaryAxis(options.secondary, index, total) ? { yAxisIndex: 1 } : {}),
      };
    }),
  };
}
