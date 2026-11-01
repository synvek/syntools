import { parseCellRef } from './core';
import type { ChartConfig, ChartRange, ChartType } from './charts';
import { DEFAULT_SHEET_METRICS, EMU_PER_PX, splitSheetRef, type SheetMetrics } from './chartXml';
import { dirOf, parseRelationships, relsPathFor, type RawChartParts } from './rawChartParts';
import { resolvePartPath } from './xlsx-normalize';

/**
 * 图表"导入即编辑"（SHEET-08 收口）。
 *
 * 导入时把文件里的原生 chart part **翻译成站内 `ChartConfig`**，同时把这些 part 从
 * `RawChartParts` 里摘掉 —— 两件事必须一起做：留下 part 又生成 config，导出时同一张图会被写两次
 * （一次来自 config、一次来自保留的 part），Excel 里就多出一张重叠的图。
 *
 * 摘除的完整链条（缺一处就会留下指向不存在 part 的引用）：
 * 1. `xl/charts/chartN.xml` 本体与其 `.rels`；
 * 2. drawing 里引用它的 `<xdr:oneCellAnchor>` / `twoCellAnchor` 块；
 * 3. drawing rels 里指向该 chart 的 `<Relationship>`；
 * 4. drawing 摘空了就整份丢掉（连同 sheet 关系）：导出侧的 `insertDrawingIntoSheet` 只在有计划时
 *    才插 `<drawing/>`，所以不留下"指向空 drawing"的悬空引用。
 *
 * 无法翻译的图（股价图 / 曲面图 / 结构不符合本站约定）**原样保留**，宁可只读也不变形。
 */

const RENDER_GROUPS = /<c:(bar|line|area|pie|scatter|radar)Chart\b[^>]*>([\s\S]*?)<\/c:\1Chart>/g;
const ANY_ANCHOR = /<xdr:(oneCellAnchor|twoCellAnchor|absoluteAnchor)\b/;

type RenderKind = 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'radar';

interface SeriesInfo {
  index: number;
  /** 系列名单元格（表头行） */
  nameCell: { row: number; column: number } | null;
  cat: ChartRange | null;
  val: ChartRange | null;
  render: RenderKind;
  /** 该系列是否挂在次坐标轴上（由所属 chart group 的 axId 决定） */
  secondary: boolean;
}

interface PartInfo {
  type: ChartType;
  series: SeriesInfo[];
  range: ChartRange;
  secondary: boolean;
  /** 只能近似还原的地方（类型降级 / 次轴系列不在末位），交给上层提示用户 */
  warnings: string[];
}

interface ChartGroupInfo {
  render: RenderKind;
  axIds: string[];
  seriesIndexes: number[];
}

/* ---------------------------------- 基础解析 ---------------------------------- */

function decodeBase64(value: string): string | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** `'Sheet'!$B$2` → 单元格坐标（去掉 `$` 再交给通用的 A1 解析） */
function cellOf(text: string | undefined): { row: number; column: number } | null {
  if (!text) return null;
  return parseCellRef(text.trim().replace(/\$/g, ''));
}

/** `'Sheet'!$B$2:$B$4` → 0 基闭区间；也接受单个单元格 */
export function parseRefRange(ref: string): ChartRange | null {
  const body = splitSheetRef(ref).body;
  const [startText, endText] = body.split(':');
  const start = cellOf(startText);
  if (!start) return null;
  const end = endText ? cellOf(endText) : start;
  if (!end) return null;
  return {
    startRow: Math.min(start.row, end.row),
    endRow: Math.max(start.row, end.row),
    startColumn: Math.min(start.column, end.column),
    endColumn: Math.max(start.column, end.column),
  };
}

/** chart group → 画法 + axId 对 + 系列序号（OOXML 里画法与所属轴都由 group 决定） */
function parseGroups(xml: string): ChartGroupInfo[] {
  const groups: ChartGroupInfo[] = [];
  RENDER_GROUPS.lastIndex = 0;
  for (const match of xml.matchAll(RENDER_GROUPS)) {
    const body = match[2] ?? '';
    const axIds = (body.match(/<c:axId val="([^"]*)"\/>/g) ?? [])
      .map((tag) => /\bval="([^"]*)"/.exec(tag)?.[1])
      .filter((id): id is string => Boolean(id));
    const seriesIndexes = (body.match(/<c:idx val="([^"]*)"\/>/g) ?? [])
      .map((tag) => Number(/\bval="([^"]*)"/.exec(tag)?.[1]))
      .filter((index) => Number.isFinite(index));
    groups.push({ render: match[1] as RenderKind, axIds, seriesIndexes });
  }
  return groups;
}

/** 次坐标轴的 axId：`<c:valAx>` 里落在右侧的那些（Excel 的双轴是"共用分类轴 + 两条数值轴"） */
function secondaryAxisIds(xml: string): Set<string> {
  const blocks = xml.match(/<c:valAx\b[\s\S]*?<\/c:valAx>/g) ?? [];
  const ids = blocks
    .map((block) => ({
      id: /<c:axId val="([^"]*)"\/>/.exec(block)?.[1],
      right: /<c:axPos val="r"\/>/.test(block),
    }))
    .filter((item): item is { id: string; right: boolean } => Boolean(item.id));
  const rightSide = ids.filter((item) => item.right).map((item) => item.id);
  // 没有显式 axPos="r" 的文件（部分生成器省略）退化为"除第一条数值轴之外的都是次轴"
  return new Set(rightSide.length > 0 ? rightSide : ids.slice(1).map((item) => item.id));
}

/** 单个系列的引用：名字单元格、分类/X 区间、数值区间 */
function parseSeries(
  xml: string,
  position: number,
): Omit<SeriesInfo, 'render' | 'secondary'> | null {
  const index = Number(/<c:idx val="(-?\d+)"\/>/.exec(xml)?.[1] ?? position);
  const tx = /<c:tx>[\s\S]*?<c:f>([^<]*)<\/c:f>[\s\S]*?<\/c:tx>/.exec(xml)?.[1];
  const cat = /<c:(?:cat|xVal)\b[\s\S]*?<c:f>([^<]*)<\/c:f>/.exec(xml)?.[1];
  const val = /<c:(?:val|yVal)\b[\s\S]*?<c:f>([^<]*)<\/c:f>/.exec(xml)?.[1];
  const valueRange = val ? parseRefRange(val) : null;
  if (!valueRange) return null;
  return {
    index: Number.isFinite(index) ? index : position,
    nameCell: cellOf(splitSheetRef(tx ?? '').body),
    cat: cat ? parseRefRange(cat) : null,
    val: valueRange,
  };
}

/** 引用合并成 ChartConfig 的数据区域：表头行/分类列都算在内（与 `resolveChart` 的约定一致） */
function mergeRange(series: readonly SeriesInfo[]): ChartRange | null {
  let startRow = Number.POSITIVE_INFINITY;
  let startColumn = Number.POSITIVE_INFINITY;
  let endRow = -1;
  let endColumn = -1;
  for (const item of series) {
    for (const range of [item.cat, item.val]) {
      if (!range) continue;
      startRow = Math.min(startRow, range.startRow);
      startColumn = Math.min(startColumn, range.startColumn);
      endRow = Math.max(endRow, range.endRow);
      endColumn = Math.max(endColumn, range.endColumn);
    }
    if (item.nameCell) {
      startRow = Math.min(startRow, item.nameCell.row);
      startColumn = Math.min(startColumn, item.nameCell.column);
      endRow = Math.max(endRow, item.nameCell.row);
      endColumn = Math.max(endColumn, item.nameCell.column);
    }
  }
  if (endRow < 0 || endColumn < 0) return null;
  return { startRow, startColumn, endRow, endColumn };
}

/** 画法集合 → 本站图表类型；表达不了就降级并记一条警告 */
function resolveType(series: readonly SeriesInfo[], warnings: string[]): ChartType | null {
  if (series.length === 0) return null;
  const renders = new Set(series.map((item) => item.render));
  if (renders.size === 1) {
    const only = series[0].render;
    return only;
  }
  // 柱 + 折线 = 组合图，但本站的组合图规则是"最后一个系列画折线"
  if (renders.size === 2 && renders.has('bar') && renders.has('line')) {
    const last = series[series.length - 1];
    const barsBefore = series.slice(0, -1).every((item) => item.render === 'bar');
    if (last.render === 'line' && barsBefore) return 'combo';
    warnings.push('combo-order');
  } else {
    warnings.push('mixed-render');
  }
  // 降级：取系列最多的那种画法
  const counts = new Map<RenderKind, number>();
  for (const item of series) counts.set(item.render, (counts.get(item.render) ?? 0) + 1);
  let best: RenderKind = series[0].render;
  for (const [render, count] of counts) {
    if (count > (counts.get(best) ?? 0)) best = render;
  }
  return best;
}

/** chart part XML → 结构信息（类型 / 区域 / 双轴 / 系列引用） */
export function parseChartPart(xml: string): PartInfo | null {
  const groups = parseGroups(xml);
  if (groups.length === 0) return null;

  const secondaryIds = secondaryAxisIds(xml);
  const renderOf = new Map<number, { render: RenderKind; secondary: boolean }>();
  for (const group of groups) {
    const onSecondary = group.axIds.length > 1 && secondaryIds.has(group.axIds[1]);
    for (const index of group.seriesIndexes) {
      renderOf.set(index, { render: group.render, secondary: onSecondary });
    }
  }

  const blocks = xml.match(/<c:ser\b[\s\S]*?<\/c:ser>/g) ?? [];
  const series: SeriesInfo[] = [];
  blocks.forEach((block, position) => {
    const parsed = parseSeries(block, position);
    if (!parsed) return;
    const placement = renderOf.get(parsed.index) ?? renderOf.get(position);
    if (!placement) return;
    series.push({ ...parsed, render: placement.render, secondary: placement.secondary });
  });
  if (series.length === 0) return null;

  // 系列顺序按 idx 排好，"最后一个系列"的规则才成立
  series.sort((a, b) => a.index - b.index);

  const warnings: string[] = [];
  const type = resolveType(series, warnings);
  if (!type) return null;

  const range = mergeRange(series);
  if (!range) return null;

  const onSecondary = series.filter((item) => item.secondary);
  const last = series[series.length - 1];
  let secondary = false;
  if (onSecondary.length > 0) {
    if (onSecondary.length === 1 && last.secondary) {
      secondary = true;
    } else {
      warnings.push('secondary-not-last');
    }
  }

  return { type, series, range, secondary, warnings };
}

/* ---------------------------------- 几何还原 ---------------------------------- */

/** drawing 里某个 rId 的 anchor → 像素（与 `computeAnchor` 互逆，行列头尺寸加回来） */
function anchorGeometry(
  drawingXml: string,
  relId: string,
  metrics: SheetMetrics,
): { x: number; y: number; width: number; height: number } | null {
  const blocks =
    drawingXml.match(
      /<xdr:(?:oneCellAnchor|twoCellAnchor)\b[\s\S]*?<\/xdr:(?:oneCellAnchor|twoCellAnchor)>/g,
    ) ?? [];
  const block = blocks.find((item) => item.includes(`r:id="${relId}"`));
  if (!block) return null;

  const from = /<xdr:from>([\s\S]*?)<\/xdr:from>/.exec(block)?.[1] ?? '';
  const col = Number(/<xdr:col>(\d+)<\/xdr:col>/.exec(from)?.[1]);
  const row = Number(/<xdr:row>(\d+)<\/xdr:row>/.exec(from)?.[1]);
  const colOff = Number(/<xdr:colOff>(-?\d+)<\/xdr:colOff>/.exec(from)?.[1] ?? 0);
  const rowOff = Number(/<xdr:rowOff>(-?\d+)<\/xdr:rowOff>/.exec(from)?.[1] ?? 0);
  if (!Number.isFinite(col) || !Number.isFinite(row)) return null;

  const columnWidth = Math.max(1, metrics.defaultColumnWidth);
  const rowHeight = Math.max(1, metrics.defaultRowHeight);
  const x = metrics.rowHeaderWidth + col * columnWidth + colOff / EMU_PER_PX;
  const y = metrics.columnHeaderHeight + row * rowHeight + rowOff / EMU_PER_PX;

  // oneCellAnchor 带 ext；twoCellAnchor 只有 from/to，按两组对角点换算
  const ext = /<xdr:ext cx="(-?\d+)" cy="(-?\d+)"\/>/.exec(block);
  if (ext) {
    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(Number(ext[1]) / EMU_PER_PX),
      height: Math.round(Number(ext[2]) / EMU_PER_PX),
    };
  }
  const to = /<xdr:to>([\s\S]*?)<\/xdr:to>/.exec(block)?.[1] ?? '';
  const toCol = Number(/<xdr:col>(\d+)<\/xdr:col>/.exec(to)?.[1]);
  const toRow = Number(/<xdr:row>(\d+)<\/xdr:row>/.exec(to)?.[1]);
  const toColOff = Number(/<xdr:colOff>(-?\d+)<\/xdr:colOff>/.exec(to)?.[1] ?? 0);
  const toRowOff = Number(/<xdr:rowOff>(-?\d+)<\/xdr:rowOff>/.exec(to)?.[1] ?? 0);
  if (!Number.isFinite(toCol) || !Number.isFinite(toRow)) return null;
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round((toCol - col) * columnWidth + (toColOff - colOff) / EMU_PER_PX),
    height: Math.round((toRow - row) * rowHeight + (toRowOff - rowOff) / EMU_PER_PX),
  };
}

/** ChartOverlay 的最小尺寸（与 `ui/ChartOverlay.tsx` 的 MIN_WIDTH / MIN_HEIGHT 保持一致） */
const MIN_WIDTH = 260;
const MIN_HEIGHT = 200;
const DEFAULT_SIZE = { width: 420, height: 280 };

function adoptGeometry(
  drawingXml: string,
  relId: string,
  metrics: SheetMetrics,
  offset: number,
): { x: number; y: number; width: number; height: number } {
  const found = anchorGeometry(drawingXml, relId, metrics);
  if (!found) {
    return { x: 24 + offset, y: 24 + offset, ...DEFAULT_SIZE };
  }
  return {
    x: found.x,
    y: found.y,
    width: Math.max(MIN_WIDTH, found.width || DEFAULT_SIZE.width),
    height: Math.max(MIN_HEIGHT, found.height || DEFAULT_SIZE.height),
  };
}

/* ---------------------------------- 摘除与装配 ---------------------------------- */

/** 从 drawing XML 里删掉引用该 rId 的 anchor 块 */
export function removeAnchor(drawingXml: string, relId: string): string {
  const pattern = /<xdr:(oneCellAnchor|twoCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:\1>/g;
  return drawingXml.replace(pattern, (block) => (block.includes(`r:id="${relId}"`) ? '' : block));
}

/** 从 rels XML 里删掉指定 id 的关系 */
export function removeRelationship(relsXml: string, id: string): string {
  return relsXml.replace(/<Relationship\b[^>]*?\/?>/g, (tag) =>
    new RegExp(`\\bId="${id}"`).test(tag) ? '' : tag,
  );
}

export interface AdoptOptions {
  /** 工作表名 → 站内 sheetId（图表按名字绑定到表，与 `SheetShapeConfig` 同一做法） */
  sheetIdsByName: Record<string, string>;
  /** 工作表名 → 像素换算度量；缺省时用默认度量 */
  metricsByName?: Record<string, SheetMetrics>;
}

export interface AdoptOutcome {
  charts: ChartConfig[];
  /** 摘掉已转换的 part 之后剩下的内容；null = 没有需要原样保留的原生图表 */
  parts: RawChartParts | null;
  /** 无法转换、继续按 part 原样保留的图表数量 */
  kept: number;
  /** 转换过程中的降级情况（类型/次轴无法精确表达），key 是 chart part 路径 */
  warnings: Record<string, string[]>;
}

export function metricsOfSheet(sheet: {
  defaultColumnWidth?: number;
  defaultRowHeight?: number;
  rowHeader?: { width?: number };
  columnHeader?: { height?: number };
}): SheetMetrics {
  return {
    defaultColumnWidth: sheet.defaultColumnWidth || DEFAULT_SHEET_METRICS.defaultColumnWidth,
    defaultRowHeight: sheet.defaultRowHeight || DEFAULT_SHEET_METRICS.defaultRowHeight,
    rowHeaderWidth: sheet.rowHeader?.width ?? DEFAULT_SHEET_METRICS.rowHeaderWidth,
    columnHeaderHeight: sheet.columnHeader?.height ?? DEFAULT_SHEET_METRICS.columnHeaderHeight,
  };
}

/**
 * 把原生 chart part 转成可编辑的 `ChartConfig`，并从 `RawChartParts` 中摘除。
 * 无法转换的图表保持原样（仍在 `parts` 里），所以"转换一部分"也是安全的。
 */
export function adoptChartParts(
  raw: RawChartParts | null | undefined,
  options: AdoptOptions,
): AdoptOutcome {
  if (!raw) return { charts: [], parts: null, kept: 0, warnings: {} };

  const parts: Record<string, string> = { ...raw.parts };
  const sheetDrawings: Record<string, string> = { ...raw.sheetDrawings };
  const charts: ChartConfig[] = [];
  const warnings: Record<string, string[]> = {};
  let kept = 0;
  let offset = 0;

  for (const [sheetName, drawingPath] of Object.entries(raw.sheetDrawings)) {
    const sheetId = options.sheetIdsByName[sheetName];
    const metrics = options.metricsByName?.[sheetName] ?? DEFAULT_SHEET_METRICS;
    const encodedDrawing = parts[drawingPath];
    if (!encodedDrawing) continue;
    let drawingXml = decodeBase64(encodedDrawing);
    if (drawingXml === null) continue;

    const drawingRelsPath = relsPathFor(drawingPath);
    const encodedRels = parts[drawingRelsPath];
    let drawingRelsXml = encodedRels ? decodeBase64(encodedRels) : null;
    if (!drawingRelsXml) continue;

    const chartRels = parseRelationships(drawingRelsXml).filter((item) =>
      /relationships\/chart$/.test(item.type),
    );

    for (const rel of chartRels) {
      const chartPath = resolvePartPath(rel.target, dirOf(drawingPath));
      if (!chartPath) {
        kept += 1;
        continue;
      }
      const encodedChart = parts[chartPath];
      const chartXml = encodedChart ? decodeBase64(encodedChart) : null;
      const info = chartXml ? parseChartPart(chartXml) : null;
      // 认不出来 / 没有数据引用 / 没有归属工作表 → 保持原样，绝不猜
      if (!info || !sheetId) {
        kept += 1;
        continue;
      }

      const geometry = adoptGeometry(drawingXml, rel.id, metrics, offset);
      offset += 24;
      charts.push({
        id: `chart-import-${charts.length + 1}`,
        type: info.type,
        range: info.range,
        sheetId,
        ...(info.secondary ? { secondary: true } : {}),
        ...geometry,
      });
      if (info.warnings.length > 0) warnings[chartPath] = info.warnings;

      drawingXml = removeAnchor(drawingXml, rel.id);
      drawingRelsXml = removeRelationship(drawingRelsXml, rel.id);
      delete parts[chartPath];
      delete parts[relsPathFor(chartPath)];
    }

    // drawing 摘空了就整份丢掉：导出侧只在有计划时才插 <drawing/>，不会留下悬空引用
    if (!ANY_ANCHOR.test(drawingXml)) {
      delete parts[drawingPath];
      delete parts[drawingRelsPath];
      delete sheetDrawings[sheetName];
      continue;
    }
    parts[drawingPath] = encodeBase64(drawingXml);
    parts[drawingRelsPath] = encodeBase64(drawingRelsXml);
  }

  // 没有 drawing 了，剩下的只可能是"转走的图表内嵌图片"这类孤儿 part —— 一起丢掉，别把垃圾写回文件
  const remaining: RawChartParts | null =
    Object.keys(sheetDrawings).length === 0 || Object.keys(parts).length === 0
      ? null
      : { ...raw, parts, sheetDrawings };

  return { charts, parts: remaining, kept, warnings };
}
