/**
 * 排版与层级操作的纯函数：对齐、等距分布、层级重排、编组包围盒、边样式归一化。
 * 不引用 React Flow 与 DOM，全部可单测。
 */

import { DEFAULT_EDGE_STYLE, type FlowEdgeStyle, type ShapeKind } from './model/types';
import { shapeSize } from './model/shapes';

/** 节点的绝对包围盒（排版计算用，坐标需为画布绝对坐标） */
export interface LayoutBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';
export type LayerOp = 'front' | 'back' | 'forward' | 'backward';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** 节点尺寸：优先用户调整过的尺寸，其次图形目录默认值 */
export function boxSizeOf(node: { width?: number; height?: number; data: { kind: ShapeKind } }): {
  width: number;
  height: number;
} {
  const def = shapeSize(node.data.kind);
  return { width: node.width ?? def.width, height: node.height ?? def.height };
}

/** 一组节点的整体边界；空集合返回 null */
export function groupBounds(boxes: LayoutBox[]): Omit<LayoutBox, 'id'> | null {
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** 对齐：以选中集合的整体边界为基准，返回每个节点的新位置 */
export function computeAlign(
  boxes: LayoutBox[],
  mode: AlignMode,
): Record<string, { x: number; y: number }> {
  const bounds = groupBounds(boxes);
  if (!bounds) return {};
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const hcenter = bounds.x + bounds.width / 2;
  const vcenter = bounds.y + bounds.height / 2;

  const out: Record<string, { x: number; y: number }> = {};
  for (const b of boxes) {
    let { x, y } = b;
    switch (mode) {
      case 'left':
        x = bounds.x;
        break;
      case 'right':
        x = right - b.width;
        break;
      case 'hcenter':
        x = hcenter - b.width / 2;
        break;
      case 'top':
        y = bounds.y;
        break;
      case 'bottom':
        y = bottom - b.height;
        break;
      case 'vcenter':
        y = vcenter - b.height / 2;
        break;
    }
    out[b.id] = { x: Math.round(x), y: Math.round(y) };
  }
  return out;
}

/** 等距分布：少于 3 个节点时无意义，返回空 */
export function computeDistribute(
  boxes: LayoutBox[],
  axis: 'h' | 'v',
): Record<string, { x: number; y: number }> {
  if (boxes.length < 3) return {};
  const sizeOf = (b: LayoutBox) => (axis === 'h' ? b.width : b.height);
  const startOf = (b: LayoutBox) => (axis === 'h' ? b.x : b.y);
  const sorted = [...boxes].sort((a, b) => startOf(a) - startOf(b));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = startOf(last) + sizeOf(last) - startOf(first);
  const total = sorted.reduce((sum, b) => sum + sizeOf(b), 0);
  const gap = (span - total) / (sorted.length - 1);

  const out: Record<string, { x: number; y: number }> = {};
  let cursor = startOf(first);
  for (const b of sorted) {
    out[b.id] =
      axis === 'h'
        ? { x: Math.round(cursor), y: Math.round(b.y) }
        : { x: Math.round(b.x), y: Math.round(cursor) };
    cursor += sizeOf(b) + gap;
  }
  return out;
}

/**
 * 层级重排：数组顺序即堆叠顺序（越靠后越上层）。
 * 只改顺序，调用方需再用 orderNodesByHierarchy 归一以保证父在子前。
 */
export function reorderLayers<T extends { id: string }>(
  items: readonly T[],
  selected: ReadonlySet<string>,
  op: LayerOp,
): T[] {
  if (selected.size === 0) return [...items];
  const picked = items.filter((i) => selected.has(i.id));
  const rest = items.filter((i) => !selected.has(i.id));

  switch (op) {
    case 'front':
      return [...rest, ...picked];
    case 'back':
      return [...picked, ...rest];
    case 'forward': {
      const result = [...items];
      for (let i = result.length - 2; i >= 0; i -= 1) {
        if (selected.has(result[i].id) && !selected.has(result[i + 1].id)) {
          [result[i], result[i + 1]] = [result[i + 1], result[i]];
        }
      }
      return result;
    }
    case 'backward':
    default: {
      const result = [...items];
      for (let i = 1; i < result.length; i += 1) {
        if (selected.has(result[i].id) && !selected.has(result[i - 1].id)) {
          [result[i], result[i - 1]] = [result[i - 1], result[i]];
        }
      }
      return result;
    }
  }
}

/** 边样式归一化：补齐缺失字段并限制线宽范围 */
export function normalizeEdgeStyle(input?: Partial<FlowEdgeStyle> | null): FlowEdgeStyle {
  const d = DEFAULT_EDGE_STYLE;
  if (!input) return { ...d };
  const sw = Number(input.strokeWidth ?? d.strokeWidth);
  return {
    type: input.type ?? d.type,
    stroke: input.stroke ?? d.stroke,
    // 注意：0 是合法的显式输入，会被 clamp 到最小值 1，不能被当成 falsy 走默认值
    strokeWidth: clamp(Number.isFinite(sw) ? sw : d.strokeWidth, 1, 8),
    dash: input.dash ?? d.dash,
    startArrow: input.startArrow ?? d.startArrow,
    endArrow: input.endArrow ?? d.endArrow,
  };
}

/** 线样式 → SVG stroke-dasharray（手绘线型在此给出基础节奏，形变由滤镜负责） */
export function dashArrayOf(dash: FlowEdgeStyle['dash'], width: number): string | undefined {
  switch (dash) {
    case 'dashed':
    case 'sketchDashed':
      return `${width * 3} ${width * 2}`;
    case 'dotted':
      return `${width} ${width}`;
    case 'dashdot':
      return `${width * 4} ${width * 2} ${width} ${width * 2}`;
    case 'solid':
    case 'sketch':
    default:
      return undefined;
  }
}

/** 是否为手绘线型（需要叠加油漆抖动滤镜） */
export function isSketchDash(dash: FlowEdgeStyle['dash'] | undefined): boolean {
  return dash === 'sketch' || dash === 'sketchDashed';
}

/** 节点轮廓线型 → SVG stroke-dasharray */
export function nodeDashArrayOf(
  dash: 'solid' | 'dashed' | 'dotted' | undefined,
  width: number,
): string | undefined {
  switch (dash) {
    case 'dashed':
      return `${width * 3} ${width * 2}`;
    case 'dotted':
      return `${width} ${width}`;
    case 'solid':
    default:
      return undefined;
  }
}

/**
 * 多选批量编辑：取集合内的公共值。
 * 全部相同 → 返回该值；存在差异 → 返回 undefined（UI 显示为「混合」）。
 */
export function commonValue<T>(values: readonly T[]): T | undefined {
  if (values.length === 0) return undefined;
  const [first, ...rest] = values;
  return rest.every((v) => v === first) ? first : undefined;
}

/* --------------------------- 连线折点与正交路由 --------------------------- */

export interface Point {
  x: number;
  y: number;
}

/** 轴对齐矩形（障碍物只需包围盒，不要求 id） */
export interface OrthogonalBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 轴对齐线段是否与矩形相交（折线均为水平/竖直段，可直接用包围盒判定） */
function segmentHitsRect(a: Point, b: Point, r: OrthogonalBox): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return minX < r.x + r.width && maxX > r.x && minY < r.y + r.height && maxY > r.y;
}

function countHits(path: readonly Point[], obstacles: readonly OrthogonalBox[]): number {
  let hits = 0;
  for (let i = 1; i < path.length; i += 1) {
    for (const box of obstacles) {
      if (segmentHitsRect(path[i - 1], path[i], box)) hits += 1;
    }
  }
  return hits;
}

/** 去掉重复点与共线的中间点 */
export function dropCollinear(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    out.push({ x: p.x, y: p.y });
  }
  for (let i = out.length - 2; i >= 1; i -= 1) {
    const prev = out[i - 1];
    const cur = out[i];
    const next = out[i + 1];
    const collinear =
      (prev.x === cur.x && cur.x === next.x) || (prev.y === cur.y && cur.y === next.y);
    if (collinear) out.splice(i, 1);
  }
  return out;
}

/**
 * 正交（曼哈顿）路由：在起点与终点之间生成折点，尽量避开障碍包围盒。
 * 返回的是「中间折点」（不含起点与终点），可直接写入 `FlowEdgeRec.waypoints`。
 * 候选策略：H-V-H / V-H-V 中点折线，必要时从障碍并集的四侧绕行，取穿过障碍最少者。
 */
export function routeOrthogonal(
  from: Point,
  to: Point,
  obstacles: readonly OrthogonalBox[] = [],
): Point[] {
  if (Math.round(from.x) === Math.round(to.x) || Math.round(from.y) === Math.round(to.y)) return [];

  const near = obstacles.filter(
    (r) =>
      !(
        r.x > Math.max(from.x, to.x) ||
        r.x + r.width < Math.min(from.x, to.x) ||
        r.y > Math.max(from.y, to.y) ||
        r.y + r.height < Math.min(from.y, to.y)
      ),
  );

  const midX = Math.round((from.x + to.x) / 2);
  const midY = Math.round((from.y + to.y) / 2);
  const candidates: Point[][] = [
    [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to],
    [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to],
  ];

  if (near.length > 0) {
    const gap = 28;
    const top = Math.round(Math.min(...near.map((o) => o.y), from.y, to.y) - gap);
    const bottom = Math.round(Math.max(...near.map((o) => o.y + o.height), from.y, to.y) + gap);
    const left = Math.round(Math.min(...near.map((o) => o.x), from.x, to.x) - gap);
    const right = Math.round(Math.max(...near.map((o) => o.x + o.width), from.x, to.x) + gap);
    candidates.push(
      [from, { x: from.x, y: top }, { x: to.x, y: top }, to],
      [from, { x: from.x, y: bottom }, { x: to.x, y: bottom }, to],
      [from, { x: left, y: from.y }, { x: left, y: to.y }, to],
      [from, { x: right, y: from.y }, { x: right, y: to.y }, to],
    );
  }

  let best = candidates[0];
  let bestHits = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const hits = countHits(candidate, obstacles);
    if (hits < bestHits) {
      bestHits = hits;
      best = candidate;
    }
    if (bestHits === 0) break;
  }
  return dropCollinear(best).slice(1, -1);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pointToward(from: Point, to: Point, length: number): Point {
  const d = distance(from, to);
  if (d === 0) return { ...from };
  const t = Math.min(length, d) / d;
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

/** 折线 → SVG path（radius > 0 时拐角用二次贝塞尔倒角） */
export function polylinePath(points: readonly Point[], radius = 0): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const r = radius > 0 ? Math.min(radius, distance(prev, cur) / 2, distance(cur, next) / 2) : 0;
    if (r <= 0.5) {
      d += ` L ${cur.x},${cur.y}`;
      continue;
    }
    const a = pointToward(cur, prev, r);
    const b = pointToward(cur, next, r);
    d += ` L ${a.x},${a.y} Q ${cur.x},${cur.y} ${b.x},${b.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x},${last.y}`;
  return d;
}

/** 折线上按长度取中点（供连线标签定位） */
export function polylineMidpoint(points: readonly Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0] };
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += distance(points[i - 1], points[i]);
  let remain = total / 2;
  for (let i = 1; i < points.length; i += 1) {
    const len = distance(points[i - 1], points[i]);
    if (remain <= len || i === points.length - 1) {
      return pointToward(points[i - 1], points[i], remain);
    }
    remain -= len;
  }
  return { ...points[points.length - 1] };
}

/** 连线路径的描边样式（供自定义边组件 BaseEdge 使用） */
export function edgeStyleOf(style: FlowEdgeStyle): {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  filter?: string;
} {
  return {
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    strokeDasharray: dashArrayOf(style.dash, style.strokeWidth),
    filter: isSketchDash(style.dash) ? 'url(#flow-sketch)' : undefined,
  };
}

/** 自定义连线渲染组件的注册类型（箭头由组件自绘，不受内置 marker 限制） */
export const EDGE_RENDER_TYPE = 'flow';

/**
 * 把连线样式转换为 React Flow 边的渲染属性。
 * 统一使用自定义边组件（type=flow），路径与箭头在组件内按 style 渲染。
 */
export function edgePropsOf(style: FlowEdgeStyle): {
  type: string;
  style: ReturnType<typeof edgeStyleOf>;
} {
  return { type: EDGE_RENDER_TYPE, style: edgeStyleOf(style) };
}
