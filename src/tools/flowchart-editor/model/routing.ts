/**
 * 连线正交避障布线（纯函数，无 React / DOM 依赖，便于单测与复用）。
 *
 * 策略分三级：
 * 1. 起终点同行 / 同列且无遮挡 → 直连（无折点）；
 * 2. 两条 L 形候选（先横后竖 / 先竖后横）任一无遮挡 → 采用该 L 形（最整洁）；
 * 3. 否则在栅格上用 A* 搜索只走水平 / 竖直段的绕障路径，转向带惩罚。
 * 搜索失败（栅格过大、被完全封死等）时退化为 L 形折线，保证连线始终可用。
 */

import { dropCollinear } from '../ops';
import type { AnchorSide } from '../core';
import type { Waypoint } from './types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 带 id 的障碍包围盒（id 用于按边排除自身起终点节点） */
export interface ObstacleRect extends Rect {
  id?: string;
}

export interface RoutePoint {
  x: number;
  y: number;
}

/** 单条边待布线的起终点（绝对坐标，通常为锚点外推后的短桩端点） */
export interface RouteEdge {
  id: string;
  from: RoutePoint;
  to: RoutePoint;
  /** 起点所在边（端点法线方向）：用于生成沿法线进出、观感与 draw.io 一致的 Z 形路由 */
  fromSide?: AnchorSide;
  /** 终点所在边 */
  toSide?: AnchorSide;
  /** 该边起终点所属节点 id：对应障碍会被忽略，避免绕开自身节点 */
  exclude?: ReadonlyArray<string>;
}

export interface RouteRequest {
  edges: ReadonlyArray<RouteEdge>;
  /** 障碍包围盒 */
  obstacles: ReadonlyArray<ObstacleRect>;
  /** 栅格步长（像素，缺省 16）：越小越贴合，越大越快 */
  grid?: number;
  /** 障碍外扩间隙（像素，缺省等于栅格，保证绕行不贴边） */
  margin?: number;
  /** 搜索范围外扩（像素，缺省 240） */
  padding?: number;
}

export interface RouteResult {
  edgeId: string;
  /** 中间折点（不含起终点），可直接写入 `FlowEdgeRec.waypoints` */
  waypoints: Waypoint[];
  /** 是否找到可绕障的路径；false 表示退化为强制 L 形 */
  routed: boolean;
}

const DEFAULT_GRID = 16;
const DEFAULT_PADDING = 240;
/** 单条边的栅格规模上限：超过则逐级放大步长，保证 A* 可控 */
const MAX_CELLS = 40_000;
/** 转向惩罚（步长的倍数）：越大越倾向少转弯 */
const TURN_PENALTY_FACTOR = 4;

const DIRS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

/** 极简二叉最小堆（A* 开放集），避免引入依赖 */
class MinHeap {
  private readonly items: Array<{ f: number; s: number }> = [];

  get size(): number {
    return this.items.length;
  }

  push(item: { f: number; s: number }): void {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].f <= items[i].f) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop(): { f: number; s: number } | undefined {
    const items = this.items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && items[l].f < items[m].f) m = l;
        if (r < items.length && items[r].f < items[m].f) m = r;
        if (m === i) break;
        [items[m], items[i]] = [items[i], items[m]];
        i = m;
      }
    }
    return top;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** 轴对齐线段是否与矩形相交（正交折线的每段都是水平 / 竖直段） */
function segmentHitsRect(a: RoutePoint, b: RoutePoint, r: Rect): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return minX < r.x + r.width && maxX > r.x && minY < r.y + r.height && maxY > r.y;
}

/** 折线是否完全避开所有障碍 */
function pathClear(points: ReadonlyArray<RoutePoint>, obstacles: ReadonlyArray<Rect>): boolean {
  for (let i = 1; i < points.length; i += 1) {
    for (const r of obstacles) {
      if (segmentHitsRect(points[i - 1], points[i], r)) return false;
    }
  }
  return true;
}

/** 把相邻的斜线段补成两段正交线段（插入拐角），保证输出严格水平 / 竖直 */
function orthogonalize(points: ReadonlyArray<RoutePoint>): RoutePoint[] {
  const out: RoutePoint[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last) {
      out.push({ x: p.x, y: p.y });
      continue;
    }
    if (last.x !== p.x && last.y !== p.y) out.push({ x: p.x, y: last.y });
    out.push({ x: p.x, y: p.y });
  }
  return out;
}

/** 端点所在边是否为水平法线（左 / 右） */
function isHorizontalSide(side: AnchorSide): boolean {
  return side === 'l' || side === 'r';
}

/**
 * 沿端点法线进出的「Z 形」正交路由（draw.io 的默认观感）：
 * 两端法线同为水平 / 竖直时走中位线折返，一横一竖时退化为 L 形。
 * 返回 null 表示缺少端点法线信息，交由通用候选处理。
 */
function preferredRoute(
  from: RoutePoint,
  to: RoutePoint,
  fromSide?: AnchorSide,
  toSide?: AnchorSide,
): RoutePoint[] | null {
  if (!fromSide || !toSide) return null;
  const fh = isHorizontalSide(fromSide);
  const th = isHorizontalSide(toSide);
  if (fh && th) {
    const midX = Math.round((from.x + to.x) / 2);
    return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
  }
  if (!fh && !th) {
    const midY = Math.round((from.y + to.y) / 2);
    return [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
  }
  // 一横一竖：L 形（先沿起点法线走，再拐向终点）
  return fh ? [from, { x: to.x, y: from.y }, to] : [from, { x: from.x, y: to.y }, to];
}

/** 强制 L 形兜底折线（先横后竖） */
function fallbackWaypoints(from: RoutePoint, to: RoutePoint): Waypoint[] {
  if (Math.round(from.x) === Math.round(to.x) || Math.round(from.y) === Math.round(to.y)) return [];
  return dropCollinear(orthogonalize([from, to])).slice(1, -1);
}

function routeOne(
  edge: RouteEdge,
  obstacles: ReadonlyArray<ObstacleRect>,
  grid: number,
  margin: number,
  padding: number,
): RouteResult {
  const { from, to } = edge;
  const exclude = edge.exclude;
  const obs =
    exclude && exclude.length > 0
      ? obstacles.filter((o) => !o.id || !exclude.includes(o.id))
      : obstacles;
  const sameX = Math.round(from.x) === Math.round(to.x);
  const sameY = Math.round(from.y) === Math.round(to.y);
  if (sameX && sameY) return { edgeId: edge.id, waypoints: [], routed: true };

  // 1) 直连
  if ((sameX || sameY) && pathClear([from, to], obs)) {
    return { edgeId: edge.id, waypoints: [], routed: true };
  }

  // 2) 沿端点法线的 Z 形（最贴近 draw.io 的默认路由）
  if (!sameX && !sameY) {
    const preferred = preferredRoute(from, to, edge.fromSide, edge.toSide);
    if (preferred && pathClear(preferred, obs)) {
      return { edgeId: edge.id, waypoints: dropCollinear(preferred).slice(1, -1), routed: true };
    }
  }

  // 3) L 形候选（优先整洁结果）
  if (!sameX && !sameY) {
    const hv: RoutePoint[] = [from, { x: to.x, y: from.y }, to];
    const vh: RoutePoint[] = [from, { x: from.x, y: to.y }, to];
    if (pathClear(hv, obs)) {
      return { edgeId: edge.id, waypoints: dropCollinear(hv).slice(1, -1), routed: true };
    }
    if (pathClear(vh, obs)) {
      return { edgeId: edge.id, waypoints: dropCollinear(vh).slice(1, -1), routed: true };
    }
  }

  // 4) 栅格 A*
  const ox = Math.round((Math.min(from.x, to.x) - padding) / grid) * grid;
  const oy = Math.round((Math.min(from.y, to.y) - padding) / grid) * grid;
  const maxX = Math.max(from.x, to.x) + padding;
  const maxY = Math.max(from.y, to.y) + padding;

  let step = grid;
  let cols = Math.max(2, Math.ceil((maxX - ox) / step) + 1);
  let rows = Math.max(2, Math.ceil((maxY - oy) / step) + 1);
  while (cols * rows > MAX_CELLS && step < 4096) {
    step *= 2;
    cols = Math.max(2, Math.ceil((maxX - ox) / step) + 1);
    rows = Math.max(2, Math.ceil((maxY - oy) / step) + 1);
  }

  const blocked = new Uint8Array(cols * rows);
  for (const o of obs) {
    const x0 = o.x - margin;
    const y0 = o.y - margin;
    const x1 = o.x + o.width + margin;
    const y1 = o.y + o.height + margin;
    const cx0 = clamp(Math.floor((x0 - ox) / step), 0, cols - 1);
    const cx1 = clamp(Math.ceil((x1 - ox) / step), 0, cols - 1);
    const cy0 = clamp(Math.floor((y0 - oy) / step), 0, rows - 1);
    const cy1 = clamp(Math.ceil((y1 - oy) / step), 0, rows - 1);
    for (let cy = cy0; cy <= cy1; cy += 1) {
      const py = oy + cy * step;
      if (py < y0 || py > y1) continue;
      for (let cx = cx0; cx <= cx1; cx += 1) {
        const px = ox + cx * step;
        if (px < x0 || px > x1) continue;
        blocked[cy * cols + cx] = 1;
      }
    }
  }

  const cellOf = (p: RoutePoint): number => {
    const cx = clamp(Math.round((p.x - ox) / step), 0, cols - 1);
    const cy = clamp(Math.round((p.y - oy) / step), 0, rows - 1);
    return cy * cols + cx;
  };
  const startIdx = cellOf(from);
  const goalIdx = cellOf(to);
  blocked[startIdx] = 0;
  blocked[goalIdx] = 0;

  const gx = goalIdx % cols;
  const gy = Math.floor(goalIdx / cols);
  const heuristic = (idx: number): number => {
    const x = idx % cols;
    const y = Math.floor(idx / cols);
    return (Math.abs(x - gx) + Math.abs(y - gy)) * step;
  };

  const turnPenalty = step * TURN_PENALTY_FACTOR;
  const total = cols * rows * 4;
  const gScore = new Float64Array(total).fill(Number.POSITIVE_INFINITY);
  const cameFrom = new Int32Array(total).fill(-1);
  const heap = new MinHeap();
  for (let d = 0; d < 4; d += 1) {
    const s = startIdx * 4 + d;
    gScore[s] = 0;
    heap.push({ f: heuristic(startIdx), s });
  }

  let goalState = -1;
  while (heap.size > 0) {
    const item = heap.pop()!;
    const idx = item.s >> 2;
    const dir = item.s & 3;
    if (item.f > gScore[item.s] + heuristic(idx) + 1e-6) continue;
    if (idx === goalIdx) {
      goalState = item.s;
      break;
    }
    const x = idx % cols;
    const y = Math.floor(idx / cols);
    const base = gScore[item.s];
    for (let nd = 0; nd < 4; nd += 1) {
      const nx = x + DIRS[nd].dx;
      const ny = y + DIRS[nd].dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const nidx = ny * cols + nx;
      if (blocked[nidx]) continue;
      const ns = nidx * 4 + nd;
      const cost = base + step + (nd === dir ? 0 : turnPenalty);
      if (cost < gScore[ns]) {
        gScore[ns] = cost;
        cameFrom[ns] = item.s;
        heap.push({ f: cost + heuristic(nidx), s: ns });
      }
    }
  }

  if (goalState < 0) {
    return { edgeId: edge.id, waypoints: fallbackWaypoints(from, to), routed: false };
  }

  const cells: number[] = [];
  for (let s = goalState; s !== -1; s = cameFrom[s]) cells.push(s >> 2);
  cells.reverse();

  const mid = cells
    .slice(1, -1)
    .map((i) => ({ x: ox + (i % cols) * step, y: oy + Math.floor(i / cols) * step }));
  const waypoints = dropCollinear(orthogonalize([from, ...mid, to])).slice(1, -1);
  return { edgeId: edge.id, waypoints, routed: true };
}

/** 批量正交避障布线：逐条边独立寻路，返回可写入 waypoints 的结果 */
export function routeEdges(req: RouteRequest): RouteResult[] {
  const grid = req.grid ?? DEFAULT_GRID;
  const margin = req.margin ?? grid;
  const padding = req.padding ?? DEFAULT_PADDING;
  return req.edges.map((edge) => routeOne(edge, req.obstacles, grid, margin, padding));
}
