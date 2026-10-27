/**
 * Pure functions for layout and layering: align, equal spacing, layer reordering, group bounding boxes, edge style normalization.
 * No React Flow or DOM references, so everything is unit-testable.
 */

import { DEFAULT_EDGE_STYLE, type FlowEdgeStyle, type ShapeKind } from './model/types';
import { shapeSize } from './model/shapes';

/** Absolute bounding box of a node (for layout math; coordinates must be canvas-absolute) */
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

/** Node size: prefer the user-adjusted size, otherwise the shape catalog default */
export function boxSizeOf(node: { width?: number; height?: number; data: { kind: ShapeKind } }): {
  width: number;
  height: number;
} {
  const def = shapeSize(node.data.kind);
  return { width: node.width ?? def.width, height: node.height ?? def.height };
}

/** Overall bounds of a set of nodes; null for an empty set */
export function groupBounds(boxes: LayoutBox[]): Omit<LayoutBox, 'id'> | null {
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Alignment reference rect (canvas / page bounds) */
export interface AlignRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Align within the given reference rect: returns each node's new position */
function alignBoxes(
  boxes: LayoutBox[],
  mode: AlignMode,
  bounds: AlignRect,
): Record<string, { x: number; y: number }> {
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

/** Align: based on the overall bounds of the selection, returns each node's new position */
export function computeAlign(
  boxes: LayoutBox[],
  mode: AlignMode,
): Record<string, { x: number; y: number }> {
  const bounds = groupBounds(boxes);
  if (!bounds) return {};
  return alignBoxes(boxes, mode, bounds);
}

/** Align to a given rect (canvas / page bounds) */
export function computeAlignToRect(
  boxes: LayoutBox[],
  mode: AlignMode,
  rect: AlignRect,
): Record<string, { x: number; y: number }> {
  if (boxes.length === 0) return {};
  return alignBoxes(boxes, mode, rect);
}

/** Equal spacing: meaningless with fewer than 3 nodes, returns empty */
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
 * Distribute across the given rect's two ends: the first and last nodes touch the rect's edges and the rest are equally spaced.
 * Meaningless with fewer than 2 nodes (returns empty).
 */
export function computeDistributeInRect(
  boxes: LayoutBox[],
  axis: 'h' | 'v',
  rect: AlignRect,
): Record<string, { x: number; y: number }> {
  if (boxes.length < 2) return {};
  const sizeOf = (b: LayoutBox) => (axis === 'h' ? b.width : b.height);
  const startOf = (b: LayoutBox) => (axis === 'h' ? b.x : b.y);
  const sorted = [...boxes].sort((a, b) => startOf(a) - startOf(b));
  const total = sorted.reduce((sum, b) => sum + sizeOf(b), 0);
  const spanStart = axis === 'h' ? rect.x : rect.y;
  const spanEnd = axis === 'h' ? rect.x + rect.width : rect.y + rect.height;
  const gap = (spanEnd - spanStart - total) / (sorted.length - 1);

  const out: Record<string, { x: number; y: number }> = {};
  let cursor = spanStart;
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
 * Layer reordering: array order is stacking order (later entries are on top).
 * Only order changes; callers must normalize with orderNodesByHierarchy so parents precede children.
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

/** Edge style normalization: fill in missing fields and clamp the stroke width */
export function normalizeEdgeStyle(input?: Partial<FlowEdgeStyle> | null): FlowEdgeStyle {
  const d = DEFAULT_EDGE_STYLE;
  if (!input) return { ...d };
  const sw = Number(input.strokeWidth ?? d.strokeWidth);
  return {
    type: input.type ?? d.type,
    stroke: input.stroke ?? d.stroke,
    // Note: 0 is a valid explicit input that clamps to the minimum of 1, so it must not be treated as falsy and replaced by the default
    strokeWidth: clamp(Number.isFinite(sw) ? sw : d.strokeWidth, 1, 8),
    dash: input.dash ?? d.dash,
    startArrow: input.startArrow ?? d.startArrow,
    endArrow: input.endArrow ?? d.endArrow,
    jumpStyle: input.jumpStyle ?? d.jumpStyle ?? 'none',
  };
}

/** Line style → SVG stroke-dasharray (hand-drawn styles give the base rhythm here; the distortion comes from the filter) */
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

/** Whether this is a hand-drawn line type (needs the paint-jitter filter layered on) */
export function isSketchDash(dash: FlowEdgeStyle['dash'] | undefined): boolean {
  return dash === 'sketch' || dash === 'sketchDashed';
}

/** Node outline line style → SVG stroke-dasharray */
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
 * Multi-select batch edit: take the common value across the set.
 * All equal → return that value; any difference → return undefined (shown as "mixed" in the UI).
 */
export function commonValue<T>(values: readonly T[]): T | undefined {
  if (values.length === 0) return undefined;
  const [first, ...rest] = values;
  return rest.every((v) => v === first) ? first : undefined;
}

/* --------------------------- Edge waypoints and orthogonal routing --------------------------- */

export interface Point {
  x: number;
  y: number;
}

/** Axis-aligned rect (obstacles only need a bounding box, no id required) */
export interface OrthogonalBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Whether an axis-aligned segment intersects a rect (polylines are all horizontal/vertical segments, so bounds suffice) */
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

/** Drop duplicate points and collinear intermediate points */
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
 * Orthogonal (Manhattan) routing: generate waypoints between the start and end points, avoiding obstacle boxes where possible.
 * Returns the intermediate waypoints (excluding the endpoints), ready to write into `FlowEdgeRec.waypoints`.
 * Candidate strategy: H-V-H / V-H-V midpoint polylines, detouring around the union of obstacles on all four sides when needed, taking the fewest crossings.
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

/** Polyline → SVG path (corners get a quadratic bezier chamfer when radius > 0) */
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

/** Sample the midpoint by arc length along a polyline (for positioning edge labels) */
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

/** Stroke style for an edge path (used by the custom edge component with BaseEdge) */
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

/** Registered type of the custom edge render component (arrows are drawn by the component, free of built-in marker limits) */
export const EDGE_RENDER_TYPE = 'flow';

/**
 * Convert an edge style into React Flow edge render props.
 * A custom edge component is always used (type=flow), with path and arrows rendered from the style inside it.
 */
export function edgePropsOf(style: FlowEdgeStyle): {
  type: string;
  style: ReturnType<typeof edgeStyleOf>;
} {
  return { type: EDGE_RENDER_TYPE, style: edgeStyleOf(style) };
}
