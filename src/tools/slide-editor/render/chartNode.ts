import Konva from 'konva';
import type { ChartElement } from '../model/types';

/**
 * 图表元素 → Konva 矢量节点。
 *
 * 为什么不用 echarts 离屏渲染成位图：
 * 缩略图（`render/thumbnail.ts`）与 PNG / PDF 光栅导出（`io/raster.ts`）都是
 * **同步**渲染的，没有等待异步图片解码的机会，位图方案会让这些场景里的图表变空白。
 * 用 Konva 图元直接画，既保持矢量清晰，又让所有渲染路径行为一致。
 *
 * 与导出的关系：画布上的矢量图只负责展示与导出位图；
 * 导出 .pptx 时走 pptxgenjs 的原生 `addChart`，在 PowerPoint 里仍是可编辑数据图表。
 */

const DEFAULT_PALETTE = [
  '#4472C4',
  '#ED7D31',
  '#A5A5A5',
  '#FFC000',
  '#5B9BD5',
  '#70AD47',
  '#264478',
  '#9E480E',
];

const LABEL_FONT = 'Arial, Helvetica, sans-serif';
const AXIS_WIDTH = 46;
const AXIS_HEIGHT = 26;
const PADDING = 6;

function paletteOf(element: ChartElement): string[] {
  const custom = element.options?.palette?.filter(Boolean) ?? [];
  return custom.length > 0 ? custom : DEFAULT_PALETTE;
}

function niceMax(values: number[]): number {
  const max = values.reduce((acc, value) => Math.max(acc, Math.abs(value)), 0);
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / magnitude) * magnitude;
}

function formatNumber(value: number): string {
  if (Math.abs(value) >= 10000) return `${(value / 1000).toFixed(1)}k`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function textNode(value: string, size: number, color: string): Konva.Text {
  return new Konva.Text({
    text: value,
    fontSize: size,
    fontFamily: LABEL_FONT,
    fill: color,
    listening: false,
  });
}

interface Plot {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 图表布局：标题在上、图例在下、左侧留值轴、下方留类别轴 */
function layout(element: ChartElement): {
  plot: Plot;
  palette: string[];
  titleHeight: number;
  showLegend: boolean;
} {
  const width = Math.max(1, element.width);
  const height = Math.max(1, element.height);
  const titleHeight = element.title?.trim() ? Math.min(34, Math.round(height * 0.16)) : 0;
  const showLegend =
    (element.options?.legend ?? true) &&
    element.series.length > 1 &&
    element.chartType !== 'pie' &&
    element.chartType !== 'doughnut';
  const legendHeight = showLegend ? Math.min(26, Math.round(height * 0.14)) : 0;
  const plot: Plot = {
    x: AXIS_WIDTH,
    y: titleHeight + PADDING,
    width: Math.max(1, width - AXIS_WIDTH - PADDING * 2),
    height: Math.max(1, height - titleHeight - legendHeight - AXIS_HEIGHT - PADDING * 2),
  };
  return { plot, palette: paletteOf(element), titleHeight, showLegend };
}

/** 值轴刻度（4 段）与网格线 */
function addValueAxis(group: Konva.Group, plot: Plot, max: number, grid: boolean): void {
  const color = '#94A3B8';
  for (let i = 0; i <= 4; i += 1) {
    const ratio = i / 4;
    const y = plot.y + plot.height - plot.height * ratio;
    if (grid && i > 0) {
      group.add(
        new Konva.Line({
          points: [plot.x, y, plot.x + plot.width, y],
          stroke: '#E2E8F0',
          strokeWidth: 1,
          listening: false,
        }),
      );
    }
    const label = textNode(formatNumber(max * ratio), 11, color);
    label.position({ x: 0, y: y - 7 });
    label.width(AXIS_WIDTH - 6);
    label.align('right');
    group.add(label);
  }
}

/** 类别轴标签（均匀分布在绘图区下方） */
function addCategoryAxis(group: Konva.Group, plot: Plot, categories: string[]): void {
  const count = Math.max(1, categories.length);
  const step = plot.width / count;
  categories.forEach((label, index) => {
    if (!label) return;
    const node = textNode(label, 11, '#64748B');
    node.position({ x: plot.x + step * index, y: plot.y + plot.height + 6 });
    node.width(step);
    node.align('center');
    group.add(node);
  });
}

function addTitle(group: Konva.Group, element: ChartElement, width: number): void {
  const title = element.title?.trim();
  if (!title) return;
  const node = textNode(title, 15, '#0F172A');
  node.position({ x: 0, y: 2 });
  node.width(width);
  node.align('center');
  node.fontStyle('bold');
  group.add(node);
}

function addLegend(
  group: Konva.Group,
  element: ChartElement,
  palette: string[],
  width: number,
  height: number,
): void {
  const swatch = 10;
  const gap = 14;
  const items = element.series.map((series, index) => ({
    name: series.name || `Series ${index + 1}`,
    color: palette[index % palette.length],
  }));
  const total = items.reduce((sum, item) => sum + swatch + 4 + item.name.length * 6.5 + gap, 0);
  let cursor = Math.max(0, (width - total) / 2);
  const y = height - 18;
  for (const item of items) {
    group.add(
      new Konva.Rect({
        x: cursor,
        y,
        width: swatch,
        height: swatch,
        fill: item.color,
        listening: false,
      }),
    );
    const label = textNode(item.name, 11, '#475569');
    label.position({ x: cursor + swatch + 4, y: y - 2 });
    group.add(label);
    cursor += swatch + 4 + item.name.length * 6.5 + gap;
  }
}

/* ------------------------------ 各类图表 ------------------------------ */

function addBars(group: Konva.Group, element: ChartElement, plot: Plot, palette: string[]): void {
  const categories = element.categories.length > 0 ? element.categories : [''];
  const stacked = element.chartType === 'barStacked' || element.chartType === 'barPercent';
  const percent = element.chartType === 'barPercent';
  const seriesCount = Math.max(1, element.series.length);
  const slot = plot.width / categories.length;
  const groupWidth = slot * 0.68;
  const barWidth = stacked ? groupWidth : groupWidth / seriesCount;

  const totals = categories.map((_, index) =>
    element.series.reduce((sum, series) => sum + (series.values[index] ?? 0), 0),
  );
  const max = percent
    ? Math.max(1, ...totals.map((value) => Math.abs(value)))
    : niceMax(element.series.flatMap((series) => series.values));

  categories.forEach((_, categoryIndex) => {
    const baseX = plot.x + slot * categoryIndex + (slot - groupWidth) / 2;
    let stackCursor = 0;
    element.series.forEach((series, seriesIndex) => {
      const raw = series.values[categoryIndex] ?? 0;
      const value = percent ? (totals[categoryIndex] ? raw : 0) : raw;
      const height = Math.max(0, (Math.abs(value) / max) * plot.height);
      const x = stacked ? baseX : baseX + barWidth * seriesIndex;
      const y = stacked
        ? plot.y + plot.height - stackCursor - height
        : plot.y + plot.height - height;
      group.add(
        new Konva.Rect({
          x,
          y,
          width: Math.max(1, barWidth - 1),
          height,
          fill: palette[seriesIndex % palette.length],
          listening: false,
        }),
      );
      if (element.options?.dataLabels && height > 14) {
        const label = textNode(
          percent && totals[categoryIndex]
            ? `${Math.round((raw / totals[categoryIndex]) * 100)}%`
            : formatNumber(raw),
          10,
          '#334155',
        );
        label.position({ x: x - 4, y: y + height / 2 - 6 });
        label.width(barWidth + 8);
        label.align('center');
        group.add(label);
      }
      if (stacked) stackCursor += height;
    });
  });

  addValueAxis(group, plot, percent ? 100 : max, element.options?.gridLines !== false);
  addCategoryAxis(group, plot, categories);
}

function addLines(
  group: Konva.Group,
  element: ChartElement,
  plot: Plot,
  palette: string[],
  area: boolean,
): void {
  const categories = element.categories.length > 0 ? element.categories : [''];
  const max = niceMax(element.series.flatMap((series) => series.values));
  const step = categories.length > 1 ? plot.width / (categories.length - 1) : plot.width;

  element.series.forEach((series, index) => {
    const color = palette[index % palette.length];
    const points: number[] = [];
    series.values.forEach((value, valueIndex) => {
      points.push(
        plot.x + step * valueIndex,
        plot.y + plot.height - (Math.abs(value) / max) * plot.height,
      );
    });
    if (area && points.length >= 4) {
      group.add(
        new Konva.Line({
          points: [
            ...points.slice(0, 2),
            ...points,
            plot.x + step * (series.values.length - 1),
            plot.y + plot.height,
            points[0],
            plot.y + plot.height,
          ],
          closed: true,
          fill: color,
          opacity: 0.18,
          listening: false,
        }),
      );
    }
    group.add(
      new Konva.Line({
        points,
        stroke: color,
        strokeWidth: 2.5,
        lineCap: 'round',
        lineJoin: 'round',
        listening: false,
      }),
    );
    series.values.forEach((value, valueIndex) => {
      const x = plot.x + step * valueIndex;
      const y = plot.y + plot.height - (Math.abs(value) / max) * plot.height;
      group.add(
        new Konva.Circle({ x, y, radius: 3.5, fill: '#FFFFFF', stroke: color, strokeWidth: 2 }),
      );
      if (element.options?.dataLabels) {
        const label = textNode(formatNumber(value), 10, '#334155');
        label.position({ x: x - 20, y: y - 16 });
        label.width(40);
        label.align('center');
        group.add(label);
      }
    });
  });

  addValueAxis(group, plot, max, element.options?.gridLines !== false);
  addCategoryAxis(group, plot, categories);
}

function addPie(
  group: Konva.Group,
  element: ChartElement,
  plot: Plot,
  palette: string[],
  doughnut: boolean,
): void {
  const series = element.series[0];
  const values = series?.values.filter((value) => value > 0) ?? [];
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return;
  const radius = Math.max(8, Math.min(plot.width, plot.height) / 2);
  const cx = plot.x + plot.width / 2;
  const cy = plot.y + plot.height / 2;
  const inner = doughnut ? radius * 0.55 : 0;
  let angle = -90;

  values.forEach((value, index) => {
    const sweep = (value / total) * 360;
    const wedge = new Konva.Arc({
      x: cx,
      y: cy,
      innerRadius: inner,
      outerRadius: radius,
      angle: sweep,
      rotation: angle,
      fill: palette[index % palette.length],
      stroke: '#FFFFFF',
      strokeWidth: 1.5,
      listening: false,
    });
    group.add(wedge);
    if (element.options?.dataLabels) {
      const mid = ((angle + sweep / 2) * Math.PI) / 180;
      const labelRadius = (radius + inner) / 2;
      const label = textNode(`${Math.round((value / total) * 100)}%`, 11, '#FFFFFF');
      label.position({
        x: cx + Math.cos(mid) * labelRadius - 14,
        y: cy + Math.sin(mid) * labelRadius - 7,
      });
      label.width(28);
      label.align('center');
      group.add(label);
    }
    angle += sweep;
  });

  // 无类别轴，类别名以图例形式标在下方
  if (element.options?.legend !== false) {
    const names = element.categories.map((name, index) => `${name || `Item ${index + 1}`}`);
    names.forEach((name, index) => {
      const y = plot.y + plot.height + 2;
      const swatch = new Konva.Rect({
        x: plot.x + (plot.width / Math.max(1, names.length)) * index,
        y,
        width: 8,
        height: 8,
        fill: palette[index % palette.length],
        listening: false,
      });
      group.add(swatch);
      const label = textNode(name, 10, '#475569');
      label.position({ x: swatch.x() + 11, y: y - 2 });
      group.add(label);
    });
  }
}

function addScatter(
  group: Konva.Group,
  element: ChartElement,
  plot: Plot,
  palette: string[],
): void {
  const max = niceMax(element.series.flatMap((series) => series.values));
  const count = Math.max(1, element.categories.length);
  const step = plot.width / Math.max(1, count - 1 || 1);
  element.series.forEach((series, index) => {
    const color = palette[index % palette.length];
    series.values.forEach((value, valueIndex) => {
      const x = plot.x + step * valueIndex;
      const y = plot.y + plot.height - (Math.abs(value) / max) * plot.height;
      group.add(
        new Konva.Circle({ x, y, radius: 4.5, fill: color, opacity: 0.85, listening: false }),
      );
    });
  });
  addValueAxis(group, plot, max, element.options?.gridLines !== false);
  addCategoryAxis(group, plot, element.categories);
}

function addRadar(group: Konva.Group, element: ChartElement, plot: Plot, palette: string[]): void {
  const axes = Math.max(3, element.categories.length);
  const max = niceMax(element.series.flatMap((series) => series.values));
  const radius = Math.max(10, Math.min(plot.width, plot.height) / 2 - 14);
  const cx = plot.x + plot.width / 2;
  const cy = plot.y + plot.height / 2;
  const pointAt = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 * index) / axes - Math.PI / 2;
    return { x: cx + Math.cos(angle) * radius * ratio, y: cy + Math.sin(angle) * radius * ratio };
  };

  for (let ring = 1; ring <= 4; ring += 1) {
    const ratio = ring / 4;
    const points: number[] = [];
    for (let i = 0; i < axes; i += 1) {
      const p = pointAt(i, ratio);
      points.push(p.x, p.y);
    }
    group.add(
      new Konva.Line({
        points,
        closed: true,
        stroke: '#E2E8F0',
        strokeWidth: 1,
        listening: false,
      }),
    );
  }
  for (let i = 0; i < axes; i += 1) {
    const p = pointAt(i, 1);
    group.add(
      new Konva.Line({
        points: [cx, cy, p.x, p.y],
        stroke: '#E2E8F0',
        strokeWidth: 1,
        listening: false,
      }),
    );
    const label = textNode(element.categories[i] ?? '', 11, '#64748B');
    label.position({ x: p.x - 24, y: p.y - 7 });
    label.width(48);
    label.align('center');
    group.add(label);
  }

  element.series.forEach((series, index) => {
    const points: number[] = [];
    for (let i = 0; i < axes; i += 1) {
      const p = pointAt(i, Math.min(1, Math.abs(series.values[i] ?? 0) / max));
      points.push(p.x, p.y);
    }
    group.add(
      new Konva.Line({
        points,
        closed: true,
        stroke: palette[index % palette.length],
        strokeWidth: 2,
        fill: palette[index % palette.length],
        opacity: 0.5,
        listening: false,
      }),
    );
  });
}

/** 图表元素 → Konva.Group（局部坐标 0,0 → width,height） */
export function createChartNode(element: ChartElement): Konva.Group {
  const group = new Konva.Group({ listening: false });
  const { plot, palette, showLegend } = layout(element);

  addTitle(group, element, element.width);

  if (element.series.length === 0 || element.categories.length === 0) {
    const empty = textNode('（无数据）', 13, '#94A3B8');
    empty.position({ x: 0, y: plot.y + plot.height / 2 - 8 });
    empty.width(element.width);
    empty.align('center');
    group.add(empty);
    return group;
  }

  switch (element.chartType) {
    case 'bar':
    case 'barStacked':
    case 'barPercent':
      addBars(group, element, plot, palette);
      break;
    case 'line':
      addLines(group, element, plot, palette, false);
      break;
    case 'area':
      addLines(group, element, plot, palette, true);
      break;
    case 'pie':
      addPie(group, element, plot, palette, false);
      break;
    case 'doughnut':
      addPie(group, element, plot, palette, true);
      break;
    case 'scatter':
      addScatter(group, element, plot, palette);
      break;
    case 'radar':
      addRadar(group, element, plot, palette);
      break;
    default:
      addBars(group, element, plot, palette);
      break;
  }

  if (showLegend) addLegend(group, element, palette, element.width, element.height);
  return group;
}
