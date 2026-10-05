/**
 * 基于 dagre 的层次化自动布局。
 *
 * 两段式（默认开启 `preserveContainers`）：
 * 1. 先在每个容器（泳道 / 编组）内部独立排版，并让容器按内容自适应尺寸；
 * 2. 再把「容器 + 游离节点」当作一个整体排版。
 * 这样自动布局不再需要解除泳道归属，容器层级与内部相对坐标都会被保留。
 */

import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import {
  SWIMLANE_HEADER_HEIGHT,
  SWIMLANE_HEADER_WIDTH,
  isContainerKind,
  type FlowNodeData,
  type ShapeKind,
} from './model/types';
import { shapeSize } from './model/shapes';

export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

export interface LayoutOptions {
  /** 布局方向：TB 自上而下 / BT 自下而上 / LR 自左向右 / RL 自右向左 */
  direction?: LayoutDirection;
  /** 同层节点间距 */
  nodesep?: number;
  /** 层间距 */
  ranksep?: number;
  /** 保留泳道 / 编组层级（默认 true） */
  preserveContainers?: boolean;
}

/** 布局方向下拉可选值 */
export const LAYOUT_DIRECTIONS: LayoutDirection[] = ['TB', 'BT', 'LR', 'RL'];

/** 间距预设：紧凑 / 标准 / 宽松 */
export const LAYOUT_DENSITY = {
  compact: { nodesep: 32, ranksep: 44 },
  normal: { nodesep: 48, ranksep: 64 },
  loose: { nodesep: 80, ranksep: 110 },
} as const;

export type LayoutDensity = keyof typeof LAYOUT_DENSITY;

export const DEFAULT_LAYOUT_OPTIONS: Required<Omit<LayoutOptions, 'preserveContainers'>> & {
  preserveContainers: boolean;
} = {
  direction: 'TB',
  ...LAYOUT_DENSITY.normal,
  preserveContainers: true,
};

function sizeOf(node: Node<FlowNodeData>): { width: number; height: number } {
  if (node.width && node.height) return { width: node.width, height: node.height };
  if (node.measured && node.measured.width && node.measured.height) {
    return { width: node.measured.width, height: node.measured.height };
  }
  return shapeSize(node.data.kind);
}

/** 容器内部内容区的左上角（避开标题栏与内边距） */
function containerInnerOrigin(kind: ShapeKind): { x: number; y: number } {
  const padding = 14;
  if (kind === 'group') return { x: padding, y: 26 + padding };
  if (kind === 'swimlaneV') return { x: padding, y: SWIMLANE_HEADER_HEIGHT + padding };
  return { x: SWIMLANE_HEADER_WIDTH + padding, y: padding };
}

/** 跑一次 dagre，返回每个节点的左上角坐标 */
function dagreLayout(
  items: ReadonlyArray<Node<FlowNodeData>>,
  edges: ReadonlyArray<Pick<Edge, 'source' | 'target'>>,
  direction: LayoutDirection,
  nodesep: number,
  ranksep: number,
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  if (items.length === 0) return out;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep, ranksep, marginx: 0, marginy: 0 });

  for (const node of items) g.setNode(node.id, sizeOf(node));
  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  for (const node of items) {
    const pos = g.node(node.id);
    if (!pos) {
      out.set(node.id, { x: node.position.x, y: node.position.y });
      continue;
    }
    const size = sizeOf(node);
    out.set(node.id, {
      x: Math.round(pos.x - size.width / 2),
      y: Math.round(pos.y - size.height / 2),
    });
  }
  return out;
}

/**
 * 返回位置被重排后的新节点数组（不修改入参）。
 * 容器（泳道 / 编组）的子节点坐标保持「相对父节点」语义。
 */
export function layoutGraph(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  options: LayoutOptions = {},
): Node<FlowNodeData>[] {
  if (nodes.length === 0) return nodes;
  const { direction, nodesep, ranksep, preserveContainers } = {
    ...DEFAULT_LAYOUT_OPTIONS,
    ...options,
  };

  // 关闭层级保留：整体扁平重排（调用方需先把子节点坐标绝对化）
  if (!preserveContainers) {
    const positions = dagreLayout(nodes, edges, direction, nodesep, ranksep);
    return nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position }));
  }

  const containers = nodes.filter((n) => !n.parentId && isContainerKind(n.data.kind));
  const childIds = new Set(nodes.filter((n) => n.parentId).map((n) => n.id));

  /** 容器 id → 自适应后的尺寸 */
  const containerSize = new Map<string, { width: number; height: number }>();
  /** 节点 id → 新的相对/绝对坐标 */
  const innerPositions = new Map<string, { x: number; y: number }>();

  // 1) 容器内部排版 + 容器尺寸自适应
  for (const container of containers) {
    const kids = nodes.filter((n) => n.parentId === container.id);
    const def = sizeOf(container);
    if (kids.length === 0) {
      containerSize.set(container.id, def);
      continue;
    }
    const kidIds = new Set(kids.map((k) => k.id));
    const innerEdges = edges.filter((e) => kidIds.has(e.source) && kidIds.has(e.target));
    const positions = dagreLayout(kids, innerEdges, direction, nodesep, ranksep);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const kid of kids) {
      const pos = positions.get(kid.id) ?? kid.position;
      const size = sizeOf(kid);
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + size.width);
      maxY = Math.max(maxY, pos.y + size.height);
    }
    const origin = containerInnerOrigin(container.data.kind);
    const shiftX = origin.x - minX;
    const shiftY = origin.y - minY;
    for (const kid of kids) {
      const pos = positions.get(kid.id) ?? kid.position;
      innerPositions.set(kid.id, { x: Math.round(pos.x + shiftX), y: Math.round(pos.y + shiftY) });
    }
    containerSize.set(container.id, {
      width: Math.max(def.width, Math.round(maxX - minX + origin.x + 14)),
      height: Math.max(def.height, Math.round(maxY - minY + origin.y + 14)),
    });
  }

  // 2) 顶层（容器 + 游离节点）排版
  const topLevel = nodes
    .filter((n) => !n.parentId)
    .map((n) => {
      const size = containerSize.get(n.id);
      return size ? { ...n, width: size.width, height: size.height } : n;
    });

  const ownerOf = (id: string): string | undefined => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return undefined;
    return node.parentId ?? node.id;
  };
  const seen = new Set<string>();
  const topEdges: Array<{ source: string; target: string }> = [];
  for (const edge of edges) {
    const a = ownerOf(edge.source);
    const b = ownerOf(edge.target);
    if (!a || !b || a === b) continue;
    const key = `${a}->${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    topEdges.push({ source: a, target: b });
  }

  const topPositions = dagreLayout(topLevel, topEdges, direction, nodesep, ranksep);

  // 3) 合并结果：容器尺寸/位置更新，子节点用容器内部坐标，游离节点用顶层坐标
  const updatedById = new Map<string, Node<FlowNodeData>>();
  for (const node of topLevel) {
    const pos = topPositions.get(node.id) ?? node.position;
    updatedById.set(node.id, { ...node, position: pos });
  }
  for (const node of nodes) {
    if (childIds.has(node.id)) {
      const pos = innerPositions.get(node.id);
      if (pos) updatedById.set(node.id, { ...node, position: pos });
      else updatedById.set(node.id, node);
    }
  }

  return nodes.map((node) => updatedById.get(node.id) ?? node);
}
