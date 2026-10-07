/**
 * 连线跳线（crossing jump）的纯几何计算。
 *
 * 设计取舍：
 * - 只为「可精确复现几何」的连线绘制跳线：**折点正交路由**与**直线**。
 *   贝塞尔 / 无折点的圆角折线由 React Flow 内部生成路径，外部无法精确复现，
 *   强行近似会出现跳线错位，因此跳过（见 `polylineOf`）。
 * - 跳线只作用于「声明了 arc」的连线，且跳过数组中更靠前（更底层）的连线，
 *   与 draw.io 中「上层线跳过下层线」的观感一致。
 * - 连线上限超过阈值时整体降级为不绘制，避免 O(E²·S²) 失控。
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

/** 可绘制跳线的连线数上限（超过则整体降级） */
export const JUMP_EDGE_LIMIT = 150;
/** 跳线弧半径（画布单位） */
const ARC_RADIUS = 5;
/** 端点附近不画跳线（避免与节点/箭头重叠） */
const ENDPOINT_MARGIN = 8;
/** 同一位置去重阈值 */
const DEDUPE_DISTANCE = 3;

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

/**
 * 计算全部跳线标记。
 * 只在「声明 arc 的连线」与「数组中更靠前的连线」的交叉处生成标记。
 */
export function computeEdgeJumps(
  nodes: readonly JumpNode[],
  edges: readonly JumpEdge[],
  limit = JUMP_EDGE_LIMIT,
): JumpMark[] {
  const visible = edges.filter((e) => e.hidden !== true);
  if (visible.length === 0 || visible.length > limit) return [];
  const byId = new Map(nodes.map((n) => [n.id, n] as const));

  const lines = visible.map((e) => (e.hidden === true ? null : polylineOf(e, byId)));
  const marks: JumpMark[] = [];

  visible.forEach((edge, i) => {
    const jump: EdgeJumpStyle = normalizeEdgeStyle(edge.data?.style).jumpStyle ?? 'none';
    if (jump !== 'arc') return;
    const self = lines[i];
    if (!self) return;
    for (let seg = 1; seg < self.points.length; seg += 1) {
      const a1 = self.points[seg - 1];
      const a2 = self.points[seg];
      const segLen = Math.hypot(a2.x - a1.x, a2.y - a1.y);
      if (segLen < ENDPOINT_MARGIN * 2) continue;
      for (let j = 0; j < i; j += 1) {
        const other = lines[j];
        if (!other) continue;
        for (let oseg = 1; oseg < other.points.length; oseg += 1) {
          const b1 = other.points[oseg - 1];
          const b2 = other.points[oseg];
          const hit = segmentIntersection(a1, a2, b1, b2);
          if (!hit) continue;
          // 太靠近自身线段端点：跳过（避免与节点/箭头视觉冲突）
          if (
            Math.hypot(hit.x - a1.x, hit.y - a1.y) < ENDPOINT_MARGIN ||
            Math.hypot(hit.x - a2.x, hit.y - a2.y) < ENDPOINT_MARGIN
          ) {
            continue;
          }
          const ownAngle = Math.atan2(a2.y - a1.y, a2.x - a1.x);
          const otherAngle = Math.atan2(b2.y - b1.y, b2.x - b1.x);
          // 用叉积判断被穿越连线相对本线的方位，决定弧线鼓起方向
          const cross = Math.sin(otherAngle - ownAngle);
          if (Math.abs(cross) < 1e-6) continue;
          const duplicate = marks.some(
            (m) => Math.hypot(m.x - hit.x, m.y - hit.y) < DEDUPE_DISTANCE,
          );
          if (duplicate) continue;
          marks.push({
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
  });
  return marks;
}

export { polylineLength };
