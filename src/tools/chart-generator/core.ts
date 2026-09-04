import type { ToolResult } from '@/core/types';

/**
 * 在线图表生成器：CSV → SVG（多类型、图例、Y 轴、配色预设）。
 */

export type ChartType =
  | 'bar'
  | 'hbar'
  | 'line'
  | 'area'
  | 'pie'
  | 'doughnut'
  | 'scatter';

export type LegendPosition = 'top' | 'bottom' | 'left' | 'right' | 'none';

export type ColorSchemeId =
  | 'vibrant'
  | 'pastel'
  | 'ocean'
  | 'sunset'
  | 'forest'
  | 'mono'
  | 'rainbow';

export type ChartError = 'EMPTY' | 'INVALID' | 'NO_NUMERIC';

export interface ChartPoint {
  label: string;
  value: number;
}

export interface ChartOptions {
  type: ChartType;
  width: number;
  height: number;
  title: string;
  /** 数据集 / 系列名称（出现在图例） */
  seriesLabel: string;
  xLabel: string;
  yLabel: string;
  legend: LegendPosition;
  colorScheme: ColorSchemeId;
}

export const CHART_TYPES: ChartType[] = [
  'bar',
  'hbar',
  'line',
  'area',
  'pie',
  'doughnut',
  'scatter',
];

export const LEGEND_POSITIONS: LegendPosition[] = [
  'top',
  'bottom',
  'left',
  'right',
  'none',
];

export const COLOR_SCHEMES: Record<ColorSchemeId, string[]> = {
  vibrant: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'],
  pastel: ['#93c5fd', '#86efac', '#fcd34d', '#fca5a5', '#d8b4fe', '#67e8f9', '#f9a8d4', '#bef264'],
  ocean: ['#0ea5e9', '#0284c7', '#06b6d4', '#14b8a6', '#0d9488', '#0369a1', '#22d3ee', '#2dd4bf'],
  sunset: ['#f97316', '#ef4444', '#f59e0b', '#ec4899', '#fb7185', '#fdba74', '#f43f5e', '#eab308'],
  forest: ['#16a34a', '#15803d', '#65a30d', '#84cc16', '#4d7c0f', '#22c55e', '#a3e635', '#166534'],
  mono: ['#171717', '#404040', '#525252', '#737373', '#a3a3a3', '#d4d4d4', '#262626', '#e5e5e5'],
  rainbow: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'],
};

export const COLOR_SCHEME_IDS = Object.keys(COLOR_SCHEMES) as ColorSchemeId[];

export const DEFAULT_CHART_OPTIONS: ChartOptions = {
  type: 'bar',
  width: 640,
  height: 400,
  title: '',
  seriesLabel: '数据',
  xLabel: '',
  yLabel: '',
  legend: 'top',
  colorScheme: 'vibrant',
};

export const DEFAULT_CHART_CSV = `Label,Value
Alpha,40
Beta,25
Gamma,55
Delta,30
Epsilon,45`;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function isChartType(v: string): v is ChartType {
  return CHART_TYPES.includes(v as ChartType);
}

export function isLegendPosition(v: string): v is LegendPosition {
  return LEGEND_POSITIONS.includes(v as LegendPosition);
}

export function isColorSchemeId(v: string): v is ColorSchemeId {
  return COLOR_SCHEME_IDS.includes(v as ColorSchemeId);
}

export function getSchemeColors(id: ColorSchemeId | string): string[] {
  return COLOR_SCHEMES[isColorSchemeId(id) ? id : 'vibrant'];
}

export function colorAt(scheme: ColorSchemeId | string, index: number): string {
  const colors = getSchemeColors(scheme);
  return colors[index % colors.length];
}

/** 解析 CSV（首行可含表头） */
export function parseChartData(input: string): ToolResult<ChartPoint[]> {
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'EMPTY' };

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { ok: false, error: 'EMPTY' };

  const points: ChartPoint[] = [];
  let start = 0;
  const firstCells = splitCsvLine(lines[0]);
  if (
    firstCells.length >= 2 &&
    Number.isNaN(Number(firstCells[1].replace(/,/g, ''))) &&
    /label|name|key|类别|名称/i.test(firstCells[0])
  ) {
    start = 1;
  }

  for (let i = start; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.length < 2) continue;
    const label = cells[0].trim();
    const value = Number(cells[1].replace(/,/g, '').trim());
    if (!label || !Number.isFinite(value)) continue;
    points.push({ label, value });
  }

  if (points.length === 0) return { ok: false, error: 'NO_NUMERIC' };
  return { ok: true, value: points };
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if ((ch === ',' || ch === '\t' || ch === ';') && !inQuotes) {
      cells.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur);
  return cells;
}

export function generateChartSvg(
  points: ChartPoint[],
  options: ChartOptions = DEFAULT_CHART_OPTIONS,
): ToolResult<string> {
  if (points.length === 0) return { ok: false, error: 'EMPTY' };
  const opts: ChartOptions = {
    ...DEFAULT_CHART_OPTIONS,
    ...options,
    type: isChartType(options.type) ? options.type : 'bar',
    legend: isLegendPosition(options.legend) ? options.legend : 'top',
    colorScheme: isColorSchemeId(options.colorScheme) ? options.colorScheme : 'vibrant',
    width: clamp(Math.round(options.width) || 640, 200, 2000),
    height: clamp(Math.round(options.height) || 400, 160, 2000),
  };

  let body: string;
  switch (opts.type) {
    case 'line':
      body = buildCartesian(points, opts, 'line');
      break;
    case 'area':
      body = buildCartesian(points, opts, 'area');
      break;
    case 'hbar':
      body = buildHBarSvg(points, opts);
      break;
    case 'scatter':
      body = buildCartesian(points, opts, 'scatter');
      break;
    case 'pie':
      body = buildPieSvg(points, opts, false);
      break;
    case 'doughnut':
      body = buildPieSvg(points, opts, true);
      break;
    default:
      body = buildCartesian(points, opts, 'bar');
  }

  return {
    ok: true,
    value: `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}" style="background:#fff">${body}</svg>`,
  };
}

interface Layout {
  padL: number;
  padR: number;
  padT: number;
  padB: number;
  plotX: number;
  plotY: number;
  plotW: number;
  plotH: number;
  legendItems: Array<{ label: string; color: string }>;
}

function computeLayout(
  opts: ChartOptions,
  points: ChartPoint[],
  mode: 'cartesian' | 'pie' | 'hbar',
): Layout {
  const legendItems = points.map((p, i) => ({
    label: p.label,
    color: colorAt(opts.colorScheme, i),
  }));
  const showLegend = opts.legend !== 'none';
  const titleH = opts.title.trim() ? 28 : 0;
  const yLabelW = mode !== 'pie' && opts.yLabel.trim() ? 18 : 0;
  const xLabelH = mode === 'cartesian' && opts.xLabel.trim() ? 18 : 0;

  let padL = mode === 'pie' ? 16 : 56 + yLabelW;
  let padR = 20;
  let padT = 16 + titleH;
  let padB = mode === 'pie' ? 16 : 44 + xLabelH;

  if (showLegend) {
    if (opts.legend === 'top') padT += 28;
    if (opts.legend === 'bottom') padB += 28;
    if (opts.legend === 'left') padL += Math.min(140, 24 + maxLabelWidth(legendItems) * 7);
    if (opts.legend === 'right') padR += Math.min(140, 24 + maxLabelWidth(legendItems) * 7);
  }

  if (mode === 'hbar') {
    padL = Math.max(padL, 72);
    padB = Math.max(padB, 36 + (opts.xLabel.trim() ? 18 : 0));
  }

  return {
    padL,
    padR,
    padT,
    padB,
    plotX: padL,
    plotY: padT,
    plotW: Math.max(40, opts.width - padL - padR),
    plotH: Math.max(40, opts.height - padT - padB),
    legendItems,
  };
}

function maxLabelWidth(items: Array<{ label: string }>): number {
  return Math.max(4, ...items.map((i) => Math.min(16, i.label.length)));
}

function titleEl(title: string, width: number, y = 22): string {
  if (!title) return '';
  return `<text x="${width / 2}" y="${y}" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="16" font-weight="600" fill="#111827">${escapeXml(title)}</text>`;
}

function legendEl(
  opts: ChartOptions,
  layout: Layout,
  items: Array<{ label: string; color: string }>,
): string {
  if (opts.legend === 'none' || items.length === 0) return '';
  const font = 'font-family="ui-sans-serif,system-ui,sans-serif" font-size="11" fill="#374151"';
  const series = opts.seriesLabel.trim();

  if (opts.legend === 'top' || opts.legend === 'bottom') {
    const y =
      opts.legend === 'top'
        ? (opts.title.trim() ? 46 : 18)
        : opts.height - 14;
    let x = layout.plotX;
    const parts: string[] = [];
    if (series) {
      parts.push(`<text x="${x}" y="${y}" ${font} font-weight="600">${escapeXml(series)}</text>`);
      x += series.length * 8 + 16;
    }
    for (const it of items) {
      parts.push(
        `<rect x="${x}" y="${y - 9}" width="10" height="10" rx="2" fill="${it.color}"/>`,
        `<text x="${x + 14}" y="${y}" ${font}>${escapeXml(truncate(it.label, 12))}</text>`,
      );
      x += Math.min(120, 28 + Math.min(12, it.label.length) * 7);
      if (x > opts.width - layout.padR - 40) break;
    }
    return parts.join('\n');
  }

  const startX = opts.legend === 'left' ? 12 : opts.width - layout.padR + 8;
  const startY = layout.plotY;
  const parts: string[] = [];
  if (series) {
    parts.push(
      `<text x="${startX}" y="${startY}" ${font} font-weight="600">${escapeXml(truncate(series, 14))}</text>`,
    );
  }
  items.forEach((it, i) => {
    const y = startY + (series ? 18 : 0) + i * 18;
    parts.push(
      `<rect x="${startX}" y="${y - 9}" width="10" height="10" rx="2" fill="${it.color}"/>`,
      `<text x="${startX + 14}" y="${y}" ${font}>${escapeXml(truncate(it.label, 14))}</text>`,
    );
  });
  return parts.join('\n');
}

function yAxisEl(
  layout: Layout,
  min: number,
  max: number,
  yLabel: string,
): string {
  const ticks = 5;
  const range = max - min || 1;
  const parts: string[] = [
    `<line x1="${layout.plotX}" y1="${layout.plotY}" x2="${layout.plotX}" y2="${layout.plotY + layout.plotH}" stroke="#9ca3af" stroke-width="1"/>`,
    `<line x1="${layout.plotX}" y1="${layout.plotY + layout.plotH}" x2="${layout.plotX + layout.plotW}" y2="${layout.plotY + layout.plotH}" stroke="#9ca3af" stroke-width="1"/>`,
  ];
  for (let i = 0; i <= ticks; i++) {
    const t = i / ticks;
    const val = max - t * range;
    const y = layout.plotY + t * layout.plotH;
    parts.push(
      `<line x1="${layout.plotX}" y1="${y.toFixed(1)}" x2="${(layout.plotX + layout.plotW).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="1"/>`,
      `<text x="${layout.plotX - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" font-family="ui-sans-serif,system-ui,sans-serif" fill="#6b7280">${escapeXml(formatTick(val))}</text>`,
    );
  }
  if (yLabel.trim()) {
    const cx = 14;
    const cy = layout.plotY + layout.plotH / 2;
    parts.push(
      `<text x="${cx}" y="${cy}" text-anchor="middle" transform="rotate(-90 ${cx} ${cy})" font-size="12" font-family="ui-sans-serif,system-ui,sans-serif" fill="#374151">${escapeXml(yLabel.trim())}</text>`,
    );
  }
  return parts.join('\n');
}

function xAxisLabelEl(layout: Layout, opts: ChartOptions): string {
  if (!opts.xLabel.trim()) return '';
  const x = layout.plotX + layout.plotW / 2;
  const y = opts.height - 10;
  return `<text x="${x}" y="${y}" text-anchor="middle" font-size="12" font-family="ui-sans-serif,system-ui,sans-serif" fill="#374151">${escapeXml(opts.xLabel.trim())}</text>`;
}

function formatTick(n: number): string {
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  if (Number.isInteger(n)) return String(n);
  return n.toPrecision(3).replace(/\.?0+$/, '');
}

function buildCartesian(
  points: ChartPoint[],
  opts: ChartOptions,
  kind: 'bar' | 'line' | 'area' | 'scatter',
): string {
  const layout = computeLayout(opts, points, 'cartesian');
  const max = Math.max(...points.map((p) => p.value), 0);
  const min = Math.min(...points.map((p) => p.value), 0);
  const range = max - min || 1;
  const { plotX, plotY, plotW, plotH } = layout;

  const coords = points.map((p, i) => {
    const x =
      kind === 'bar'
        ? plotX
        : plotX + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2);
    const y = plotY + plotH - ((p.value - min) / range) * plotH;
    return { ...p, i, x, y, color: colorAt(opts.colorScheme, i) };
  });

  let series = '';
  if (kind === 'bar') {
    const gap = 8;
    const barW = Math.max(4, (plotW - gap * (points.length + 1)) / points.length);
    const zeroY = plotY + plotH * (max / range);
    series = coords
      .map((c) => {
        const x = plotX + gap + c.i * (barW + gap);
        const h = (Math.abs(c.value) / range) * plotH;
        const y = c.value >= 0 ? zeroY - h : zeroY;
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" fill="${c.color}" rx="3"/>
        <text x="${(x + barW / 2).toFixed(1)}" y="${(plotY + plotH + 16).toFixed(1)}" text-anchor="middle" font-size="10" font-family="ui-sans-serif,system-ui,sans-serif" fill="#4b5563">${escapeXml(truncate(c.label, 8))}</text>`;
      })
      .join('\n');
  } else if (kind === 'line' || kind === 'area') {
    const path = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(' ');
    if (kind === 'area') {
      const base = plotY + plotH;
      const areaPath = `${path} L${coords[coords.length - 1].x.toFixed(1)},${base} L${coords[0].x.toFixed(1)},${base} Z`;
      series += `<path d="${areaPath}" fill="${colorAt(opts.colorScheme, 0)}" fill-opacity="0.25"/>`;
    }
    series += `<path d="${path}" fill="none" stroke="${colorAt(opts.colorScheme, 0)}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    series += coords
      .map(
        (c) =>
          `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4.5" fill="${c.color}" stroke="#fff" stroke-width="1.5"/>
          <text x="${c.x.toFixed(1)}" y="${(plotY + plotH + 16).toFixed(1)}" text-anchor="middle" font-size="10" font-family="ui-sans-serif,system-ui,sans-serif" fill="#4b5563">${escapeXml(truncate(c.label, 8))}</text>`,
      )
      .join('\n');
  } else {
    // scatter
    series = coords
      .map(
        (c) =>
          `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="6" fill="${c.color}" fill-opacity="0.85"/>
          <text x="${c.x.toFixed(1)}" y="${(plotY + plotH + 16).toFixed(1)}" text-anchor="middle" font-size="10" font-family="ui-sans-serif,system-ui,sans-serif" fill="#4b5563">${escapeXml(truncate(c.label, 8))}</text>`,
      )
      .join('\n');
  }

  return `${titleEl(opts.title, opts.width)}
  ${legendEl(opts, layout, layout.legendItems)}
  ${yAxisEl(layout, min, max, opts.yLabel)}
  ${series}
  ${xAxisLabelEl(layout, opts)}`;
}

function buildHBarSvg(points: ChartPoint[], opts: ChartOptions): string {
  const layout = computeLayout(opts, points, 'hbar');
  const max = Math.max(...points.map((p) => p.value), 0);
  const min = Math.min(0, ...points.map((p) => p.value));
  const range = max - min || 1;
  const { plotX, plotY, plotW, plotH } = layout;
  const gap = 8;
  const barH = Math.max(4, (plotH - gap * (points.length + 1)) / points.length);

  // X axis ticks along bottom (values), Y labels are category names
  const axis = [
    `<line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotH}" stroke="#9ca3af"/>`,
    `<line x1="${plotX}" y1="${plotY + plotH}" x2="${plotX + plotW}" y2="${plotY + plotH}" stroke="#9ca3af"/>`,
  ];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    const val = min + t * range;
    const x = plotX + t * plotW;
    axis.push(
      `<line x1="${x.toFixed(1)}" y1="${plotY}" x2="${x.toFixed(1)}" y2="${(plotY + plotH).toFixed(1)}" stroke="#e5e7eb"/>`,
      `<text x="${x.toFixed(1)}" y="${(plotY + plotH + 14).toFixed(1)}" text-anchor="middle" font-size="10" font-family="ui-sans-serif,system-ui,sans-serif" fill="#6b7280">${escapeXml(formatTick(val))}</text>`,
    );
  }
  if (opts.yLabel.trim()) {
    const cx = 14;
    const cy = plotY + plotH / 2;
    axis.push(
      `<text x="${cx}" y="${cy}" text-anchor="middle" transform="rotate(-90 ${cx} ${cy})" font-size="12" font-family="ui-sans-serif,system-ui,sans-serif" fill="#374151">${escapeXml(opts.yLabel.trim())}</text>`,
    );
  }

  const bars = points
    .map((p, i) => {
      const y = plotY + gap + i * (barH + gap);
      const w = ((p.value - min) / range) * plotW;
      const color = colorAt(opts.colorScheme, i);
      return `<rect x="${plotX}" y="${y.toFixed(1)}" width="${Math.max(1, w).toFixed(1)}" height="${barH.toFixed(1)}" fill="${color}" rx="3"/>
      <text x="${plotX - 6}" y="${(y + barH / 2 + 3).toFixed(1)}" text-anchor="end" font-size="10" font-family="ui-sans-serif,system-ui,sans-serif" fill="#4b5563">${escapeXml(truncate(p.label, 10))}</text>`;
    })
    .join('\n');

  return `${titleEl(opts.title, opts.width)}
  ${legendEl(opts, layout, layout.legendItems)}
  ${axis.join('\n')}
  ${bars}
  ${xAxisLabelEl(layout, opts)}`;
}

function buildPieSvg(points: ChartPoint[], opts: ChartOptions, doughnut: boolean): string {
  const layout = computeLayout(opts, points, 'pie');
  const total = points.reduce((s, p) => s + Math.abs(p.value), 0) || 1;
  const cx = layout.plotX + layout.plotW * (opts.legend === 'right' || opts.legend === 'none' ? 0.45 : 0.5);
  const cy = layout.plotY + layout.plotH / 2;
  const r = Math.min(layout.plotW, layout.plotH) * 0.38;
  const inner = doughnut ? r * 0.55 : 0;
  let angle = -Math.PI / 2;
  const slices: string[] = [];

  points.forEach((p, i) => {
    const portion = Math.abs(p.value) / total;
    const sweep = portion * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const ix1 = cx + inner * Math.cos(angle);
    const iy1 = cy + inner * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const ix2 = cx + inner * Math.cos(angle);
    const iy2 = cy + inner * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const fill = colorAt(opts.colorScheme, i);
    if (portion >= 0.999) {
      if (doughnut) {
        slices.push(
          `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`,
          `<circle cx="${cx}" cy="${cy}" r="${inner}" fill="#ffffff"/>`,
        );
      } else {
        slices.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`);
      }
    } else if (doughnut) {
      slices.push(
        `<path d="M ${ix1.toFixed(2)} ${iy1.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${ix2.toFixed(2)} ${iy2.toFixed(2)} A ${inner} ${inner} 0 ${large} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z" fill="${fill}"/>`,
      );
    } else {
      slices.push(
        `<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${fill}"/>`,
      );
    }
  });

  const legendItems = points.map((p, i) => ({
    label: `${p.label} (${((Math.abs(p.value) / total) * 100).toFixed(0)}%)`,
    color: colorAt(opts.colorScheme, i),
  }));

  return `${titleEl(opts.title, opts.width)}
  ${legendEl(opts, layout, legendItems)}
  ${slices.join('\n')}`;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
