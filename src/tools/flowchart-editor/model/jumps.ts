/**
 * 连线跳线（crossing jump）的纯几何计算。
 *
 * 设计取舍：
 * - 只为「可精确复现几何」的连线绘制跳线：**折点正交路由**与**直线**。
 *   贝塞尔 / 无折点的圆角折线由 React Flow 内部生成路径，外部无法精确复现，
 *   强行近似会出现跳线错位，因此跳过（见 `polylineOf`）。
 * - 跳线只作用于「声明了 arc」的连线，且跳过数组中更靠前（更底层）的连线，
 *   与 draw.io 中「上层线跳过下层线」的观感一致。
 * - 性能：线段相交检测走空间网格哈希，把 O(E²·S²) 降为近似 O(E·S)；
 *   连线数超过 `JUMP_EDGE_LIMIT` 时按比例分级降级（而非整体丢弃），
 *   保证大图仍保留可读的跳线表现且开销可控。
 */

import { anchorOf } from '../core';
import { normalizeEdgeStyle } from '../ops';
import type { EdgeJumpStyle, FlowEdgeStyle, ShapeKind, Waypoint } from './types';

/** 计算跳线所需的最小节点结构（与 store 的 FlowNode 结构兼容） */
export interface JumpNode {
  id: string;
  parentId?: string | null;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  hidden?: boolean;
  data: { kind: ShapeKind };
}

/** 计算跳线所需的最小连线结构（与 store 的 FlowEdge 结构兼容） */
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

/** 一处跳线标记（画布坐标） */
export interface JumpMark {
  x: number;
  y: number;
  /** 被穿越连线的方向角（弧度），用于让弧线朝对侧鼓起 */
  angle: number;
  /** SVG 弧线 sweep 方向 */
  sweep: 0 | 1;
  radius: number;
  stroke: string;
}

/** 可绘制跳线的连线数上限（超过则按比例降级） */
export const JUMP_EDGE_LIMIT = 150;
/** 跳线弧半径（画布单位） */
const ARC_RADIUS = 5;
/** 端点附近不画跳线（避免与节点/箭头重叠） */
const ENDPOINT_MARGIN = 8;
/** 同一位置去重阈值 */
const DEDUPE_DISTANCE = 3;
/** 空间网格边长（画布单位）：越大候选越少但格子越大，取 64 折中 */
const GRID_CELL = 64;
/** 标记去重网格边长 */
const MARK_CELL = DEDUPE_DISTANCE * 2;

/** 两条线段的真交点；共线 / 平行 / 仅端点相接时返回 null */
export function segmentIntersection(a1: Point2, a2: Point2, b1: Point2, b2: Point2): Point2 | null {
  const r = { x: a2.x - a1.x, y: a2.y - a1.y };
  const s = { x: b2.x - b1.x, y: b2.y - b1.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < 1e-9) return null;
  const qp = { x: b1.x - a1.x, y: b1.y - a1.y };
  const t = (qp.x * s.y - qp.y * s.x) / denom;
  const u = (qp.x * r.y - qp.y * r.x) / denom;
  // 排除端点相接（严格内部相交）
  const EPS = 1e-6;
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return null;
  return { x: a1.x + t * r.x, y: a1.y + t * r.y };
}

/** 折线总长 */
function polylineLength(points: Point2[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

/** 取一条连线的折线顶点；无法精确复现时返回 null */
function polylineOf(
  edge: JumpEdge,
  byId: Map<string, JumpNode>,
): { points: Point2[]; style: FlowEdgeStyle } | null {
  const source = byId.get(edge.source);
  const target = byId.get(edge.target);
  if (!source || !target) return null;
  const style = normalizeEdgeStyle(edge.data?.style);
  const waypoints = edge.data?.waypoints ?? [];
  // 只有折点正交路由与直线可以精确复现（见文件头说明）
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

/** 把一条线段按其 AABB 覆盖的网格单元登记（供查询） */
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

/** 收集查询线段 AABB 覆盖单元内的候选段（自动去重） */
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
 * 计算全部跳线标记。
 * 只在「声明 arc 的连线」与「数组中更靠前的连线」的交叉处生成标记；
 * 连线数超过 `limit` 时按比例降级（保留前 limit/2 条连线参与绘制）。
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

  // 1) 空间网格：装入「更底层」（索引 < drawCount）的所有线段
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
        // 太靠近自身线段端点：跳过（避免与节点/箭头视觉冲突）
        if (
          Math.hypot(hit.x - a1.x, hit.y - a1.y) < ENDPOINT_MARGIN ||
          Math.hypot(hit.x - a2.x, hit.y - a2.y) < ENDPOINT_MARGIN
        ) {
          continue;
        }
        const ownAngle = Math.atan2(a2.y - a1.y, a2.x - a1.x);
        const otherAngle = Math.atan2(entry.b.y - entry.a.y, entry.b.x - entry.a.x);
        // 用叉积判断被穿越连线相对本线的方位，决定弧线鼓起方向
        const cross = Math.sin(otherAngle - ownAngle);
        if (Math.abs(cross) < 1e-6) continue;
        if (hasNearbyMark(hit.x, hit.y)) continue;
        addMark({
          x: hit.x,
          y: hit.y,
          // 弧线沿「本线方向」张弦，避免斜向交叉时弧线方向错乱
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
