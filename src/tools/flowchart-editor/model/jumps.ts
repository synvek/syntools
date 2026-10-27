/**
 * Pure geometry for edge crossing jumps.
 *
 * Design trade-offs:
 * - Jumps are drawn only for edges whose geometry can be reproduced exactly: **orthogonal polylines with waypoints** and **straight lines**.
 * Bezier and waypoint-free rounded polylines get their path from inside React Flow, which cannot be reproduced externally,
 * so approximating them would misplace the jumps and they are skipped (see `polylineOf`).
 * - Jumps apply only to edges that declare arc, and only to edges earlier in the array (lower in the stack),
 * matching draw.io's "upper lines hop over lower lines" look.
 * - Performance: segment intersection tests use a spatial grid hash, cutting O(E²·S²) to roughly O(E·S);
 * above `JUMP_EDGE_LIMIT` edges the result degrades stepwise (rather than dropping jumps entirely),
 * keeping large diagrams legible while keeping the cost bounded.
 */

import { anchorOf } from '../core';
import { normalizeEdgeStyle } from '../ops';
import type { EdgeJumpStyle, FlowEdgeStyle, ShapeKind, Waypoint } from './types';

/** Minimal node structure needed for jump computation (compatible with the store's FlowNode) */
export interface JumpNode {
  id: string;
  parentId?: string | null;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  hidden?: boolean;
  data: { kind: ShapeKind };
}

/** Minimal edge structure needed for jump computation (compatible with the store's FlowEdge) */
export interface JumpEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  hidden?: boolean;
  data?: { style?: Partial<FlowEdgeStyle>; waypoints?: Waypoint[] };
}

export interface Point2 {
  x: number;
  y: number;
}

/** One jump marker (canvas coordinates) */
export interface JumpMark {
  x: number;
  y: number;
  /** Direction angle (radians) of the crossed edge, used to bulge the arc to the opposite side */
  angle: number;
  /** SVG arc sweep direction */
  sweep: 0 | 1;
  radius: number;
  stroke: string;
}

/** Max number of edges for which jumps are drawn (beyond it the result degrades stepwise) */
export const JUMP_EDGE_LIMIT = 150;
/** Jump arc radius (canvas units) */
const ARC_RADIUS = 5;
/** No jumps near endpoints (avoid overlapping nodes / arrows) */
const ENDPOINT_MARGIN = 8;
/** Deduplication threshold for identical positions */
const DEDUPE_DISTANCE = 3;
/** Spatial grid cell size (canvas units): larger means fewer candidates but bigger cells; 64 is a compromise */
const GRID_CELL = 64;
/** Deduplication grid cell size */
const MARK_CELL = DEDUPE_DISTANCE * 2;

/** True intersection of two segments; null when collinear / parallel / touching at endpoints only */
export function segmentIntersection(a1: Point2, a2: Point2, b1: Point2, b2: Point2): Point2 | null {
  const r = { x: a2.x - a1.x, y: a2.y - a1.y };
  const s = { x: b2.x - b1.x, y: b2.y - b1.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < 1e-9) return null;
  const qp = { x: b1.x - a1.x, y: b1.y - a1.y };
  const t = (qp.x * s.y - qp.y * s.x) / denom;
  const u = (qp.x * r.y - qp.y * r.x) / denom;
  // Exclude endpoint touches (strict interior intersection)
  const EPS = 1e-6;
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return null;
  return { x: a1.x + t * r.x, y: a1.y + t * r.y };
}

/** Total polyline length */
function polylineLength(points: Point2[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

/** Polyline vertices of an edge; null when the geometry cannot be reproduced exactly */
function polylineOf(
  edge: JumpEdge,
  byId: Map<string, JumpNode>,
): { points: Point2[]; style: FlowEdgeStyle } | null {
  const source = byId.get(edge.source);
  const target = byId.get(edge.target);
  if (!source || !target) return null;
  const style = normalizeEdgeStyle(edge.data?.style);
  const waypoints = edge.data?.waypoints ?? [];
  // Only orthogonal polylines with waypoints and straight lines can be reproduced exactly (see the file header)
  if (waypoints.length === 0 && style.type !== 'straight') return null;
  const points: Point2[] = [
    anchorOf(source, byId, edge.sourceHandle, target).point,
    ...waypoints.map((p) => ({ x: p.x, y: p.y })),
    anchorOf(target, byId, edge.targetHandle, source).point,
  ];
  return { points, style };
}

interface SegEntry {
  a: Point2;
  b: Point2;
  owner: number;
}

function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/** Register a segment in every grid cell its AABB covers (for lookup) */
function insertSegment(grid: Map<string, SegEntry[]>, entry: SegEntry): void {
  const minX = Math.min(entry.a.x, entry.b.x);
  const maxX = Math.max(entry.a.x, entry.b.x);
  const minY = Math.min(entry.a.y, entry.b.y);
  const maxY = Math.max(entry.a.y, entry.b.y);
  const cx0 = Math.floor(minX / GRID_CELL);
  const cx1 = Math.floor(maxX / GRID_CELL);
  const cy0 = Math.floor(minY / GRID_CELL);
  const cy1 = Math.floor(maxY / GRID_CELL);
  for (let cy = cy0; cy <= cy1; cy += 1) {
    for (let cx = cx0; cx <= cx1; cx += 1) {
      const key = cellKey(cx, cy);
      const list = grid.get(key);
      if (list) list.push(entry);
      else grid.set(key, [entry]);
    }
  }
}

/** Collect candidate segments in the cells covered by the query segment's AABB (deduplicated automatically) */
function querySegments(
  grid: Map<string, SegEntry[]>,
  a: Point2,
  b: Point2,
  out: Set<SegEntry>,
): void {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const cx0 = Math.floor(minX / GRID_CELL);
  const cx1 = Math.floor(maxX / GRID_CELL);
  const cy0 = Math.floor(minY / GRID_CELL);
  const cy1 = Math.floor(maxY / GRID_CELL);
  for (let cy = cy0; cy <= cy1; cy += 1) {
    for (let cx = cx0; cx <= cx1; cx += 1) {
      const list = grid.get(cellKey(cx, cy));
      if (!list) continue;
      for (const entry of list) out.add(entry);
    }
  }
}

/**
 * Compute all jump markers.
 * Markers are produced only where an arc-declaring edge crosses an edge earlier in the array;
 * above `limit` edges the result degrades stepwise (only the first limit/2 edges take part).
 */
export function computeEdgeJumps(
  nodes: readonly JumpNode[],
  edges: readonly JumpEdge[],
  limit = JUMP_EDGE_LIMIT,
): JumpMark[] {
  const visible = edges.filter((e) => e.hidden !== true);
  if (visible.length === 0) return [];
  const drawCount = visible.length <= limit ? visible.length : Math.floor(limit / 2);
  if (drawCount <= 0) return [];

  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const lines = visible.map((e) => polylineOf(e, byId));

  // 1) spatial grid: load every segment of the lower layers (index < drawCount)
  const grid = new Map<string, SegEntry[]>();
  for (let i = 0; i < drawCount; i += 1) {
    const line = lines[i];
    if (!line) continue;
    for (let seg = 1; seg < line.points.length; seg += 1) {
      insertSegment(grid, { a: line.points[seg - 1], b: line.points[seg], owner: i });
    }
  }

  const marks: JumpMark[] = [];
  const markGrid = new Map<string, JumpMark[]>();
  const hasNearbyMark = (x: number, y: number): boolean => {
    const cx = Math.floor(x / MARK_CELL);
    const cy = Math.floor(y / MARK_CELL);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const list = markGrid.get(cellKey(cx + dx, cy + dy));
        if (!list) continue;
        for (const m of list) {
          if (Math.hypot(m.x - x, m.y - y) < DEDUPE_DISTANCE) return true;
        }
      }
    }
    return false;
  };
  const addMark = (mark: JumpMark): void => {
    marks.push(mark);
    const key = cellKey(Math.floor(mark.x / MARK_CELL), Math.floor(mark.y / MARK_CELL));
    const list = markGrid.get(key);
    if (list) list.push(mark);
    else markGrid.set(key, [mark]);
  };

  const candidates = new Set<SegEntry>();
  for (let i = 0; i < drawCount; i += 1) {
    const edge = visible[i];
    const jump: EdgeJumpStyle = normalizeEdgeStyle(edge.data?.style).jumpStyle ?? 'none';
    if (jump !== 'arc') continue;
    const self = lines[i];
    if (!self) continue;
    for (let seg = 1; seg < self.points.length; seg += 1) {
      const a1 = self.points[seg - 1];
      const a2 = self.points[seg];
      if (Math.hypot(a2.x - a1.x, a2.y - a1.y) < ENDPOINT_MARGIN * 2) continue;
      candidates.clear();
      querySegments(grid, a1, a2, candidates);
      for (const entry of candidates) {
        if (entry.owner >= i) continue;
        const hit = segmentIntersection(a1, a2, entry.a, entry.b);
        if (!hit) continue;
        // Too close to its own segment endpoint: skip (avoid visual clashes with nodes / arrows)
        if (
          Math.hypot(hit.x - a1.x, hit.y - a1.y) < ENDPOINT_MARGIN ||
          Math.hypot(hit.x - a2.x, hit.y - a2.y) < ENDPOINT_MARGIN
        ) {
          continue;
        }
        const ownAngle = Math.atan2(a2.y - a1.y, a2.x - a1.x);
        const otherAngle = Math.atan2(entry.b.y - entry.a.y, entry.b.x - entry.a.x);
        // Use the cross product to see which side of this line the crossed edge lies on, deciding the arc bulge direction
        const cross = Math.sin(otherAngle - ownAngle);
        if (Math.abs(cross) < 1e-6) continue;
        if (hasNearbyMark(hit.x, hit.y)) continue;
        addMark({
          x: hit.x,
          y: hit.y,
          // The arc spans a chord along this line's direction, so diagonal crossings do not flip the arc orientation
          angle: ownAngle,
          sweep: cross > 0 ? 1 : 0,
          radius: ARC_RADIUS,
          stroke: self.style.stroke,
        });
      }
    }
  }
  return marks;
}

export { polylineLength };
