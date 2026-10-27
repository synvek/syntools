/**
 * Orthogonal obstacle-avoiding edge routing (pure functions, no React / DOM dependency, easy to unit-test and reuse).
 *
 * Three-tier strategy:
 * 1. Endpoints share a row / column with no obstruction → connect straight (no waypoints);
 * 2. Either of the two L-shaped candidates (horizontal-then-vertical / vertical-then-horizontal) is unobstructed → use that L (cleanest);
 * 3. Otherwise run an A* search on a grid using only horizontal / vertical segments, with a penalty on turns.
 * When the search fails (grid too large, fully enclosed, etc.) it degrades to an L-shaped polyline so the edge is always usable.
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

/** Obstacle bounding box with an id (the id excludes an edge's own source/target nodes) */
export interface ObstacleRect extends Rect {
  id?: string;
}

export interface RoutePoint {
  x: number;
  y: number;
}

/** Start and end of a single edge to route (absolute coordinates, usually the stub end points pushed out from the anchors) */
export interface RouteEdge {
  id: string;
  from: RoutePoint;
  to: RoutePoint;
  /** Side the start point sits on (its normal): used to build Z-shaped routes that enter and leave along the normal, matching draw.io */
  fromSide?: AnchorSide;
  /** Side the end point sits on */
  toSide?: AnchorSide;
  /** Node ids owning this edge's start and end: their obstacles are ignored so the route does not avoid itself */
  exclude?: ReadonlyArray<string>;
}

export interface RouteRequest {
  edges: ReadonlyArray<RouteEdge>;
  /** Obstacle bounding boxes */
  obstacles: ReadonlyArray<ObstacleRect>;
  /** Grid step (pixels, default 16): smaller hugs the obstacles more closely, larger is faster */
  grid?: number;
  /** Obstacle inflation gap (pixels, defaults to the grid so routes never hug edges) */
  margin?: number;
  /** Search-bounds inflation (pixels, default 240) */
  padding?: number;
}

export interface RouteResult {
  edgeId: string;
  /** Intermediate waypoints (excluding endpoints), writable straight into `FlowEdgeRec.waypoints` */
  waypoints: Waypoint[];
  /** Whether a path around the obstacles was found; false means it degraded to a forced L shape */
  routed: boolean;
}

const DEFAULT_GRID = 16;
const DEFAULT_PADDING = 240;
/** Per-edge grid size cap: beyond it the step is enlarged stepwise so A* stays bounded */
const MAX_CELLS = 40_000;
/** Turn penalty (multiple of the grid step): higher values favor fewer turns */
const TURN_PENALTY_FACTOR = 4;

const DIRS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

/** Minimal binary min-heap (the A* open set), avoiding an extra dependency */
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

/** Whether an axis-aligned segment intersects a rectangle (every segment of an orthogonal polyline is horizontal or vertical) */
function segmentHitsRect(a: RoutePoint, b: RoutePoint, r: Rect): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return minX < r.x + r.width && maxX > r.x && minY < r.y + r.height && maxY > r.y;
}

/** Whether a polyline avoids all obstacles entirely */
function pathClear(points: ReadonlyArray<RoutePoint>, obstacles: ReadonlyArray<Rect>): boolean {
  for (let i = 1; i < points.length; i += 1) {
    for (const r of obstacles) {
      if (segmentHitsRect(points[i - 1], points[i], r)) return false;
    }
  }
  return true;
}

/** Split diagonal segments into two orthogonal segments by inserting a corner, guaranteeing strictly horizontal / vertical output */
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

/** Whether the endpoint's side has a horizontal normal (left / right) */
function isHorizontalSide(side: AnchorSide): boolean {
  return side === 'l' || side === 'r';
}

/**
 * Z-shaped orthogonal route entering and leaving along the endpoint normals (draw.io's default look):
 * with both normals horizontal or both vertical it folds through the midline; with one of each it degrades to an L shape.
 * Returns null when the endpoint normals are unknown, leaving it to the generic candidates.
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
  // One horizontal one vertical: L shape (follow the start normal, then turn toward the end)
  return fh ? [from, { x: to.x, y: from.y }, to] : [from, { x: from.x, y: to.y }, to];
}

/** Forced-L fallback polyline (horizontal first, then vertical) */
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

  // 1) straight connection
  if ((sameX || sameY) && pathClear([from, to], obs)) {
    return { edgeId: edge.id, waypoints: [], routed: true };
  }

  // 2) Z shape along the endpoint normals (closest to draw.io's default routing)
  if (!sameX && !sameY) {
    const preferred = preferredRoute(from, to, edge.fromSide, edge.toSide);
    if (preferred && pathClear(preferred, obs)) {
      return { edgeId: edge.id, waypoints: dropCollinear(preferred).slice(1, -1), routed: true };
    }
  }

  // 3) L-shaped candidates (prefer the tidy result)
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

  // 4) grid A*
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

/** Batch orthogonal obstacle-avoiding routing: routes each edge independently, returning results ready to be written to waypoints */
export function routeEdges(req: RouteRequest): RouteResult[] {
  const grid = req.grid ?? DEFAULT_GRID;
  const margin = req.margin ?? grid;
  const padding = req.padding ?? DEFAULT_PADDING;
  return req.edges.map((edge) => routeOne(edge, req.obstacles, grid, margin, padding));
}
