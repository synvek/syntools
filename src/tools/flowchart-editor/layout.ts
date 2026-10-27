/**
 * Hierarchical auto-layout powered by dagre.
 *
 * Two-pass (with `preserveContainers` enabled by default):
 * 1. Lay out each container (swimlane / group) independently and let the container resize to fit its content;
 * 2. Then lay out "containers + free nodes" as one unit.
 * Auto-layout therefore no longer needs to dissolve swimlane ownership; container hierarchy and inner relative coordinates are kept.
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
  /** Layout direction: TB top-to-bottom / BT bottom-to-top / LR left-to-right / RL right-to-left */
  direction?: LayoutDirection;
  /** Spacing between nodes on the same layer */
  nodesep?: number;
  /** Spacing between layers */
  ranksep?: number;
  /** Keep the swimlane / group hierarchy (true by default) */
  preserveContainers?: boolean;
}

/** Selectable layout directions */
export const LAYOUT_DIRECTIONS: LayoutDirection[] = ['TB', 'BT', 'LR', 'RL'];

/** Spacing presets: compact / standard / roomy */
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

/** Top-left corner of a container's content area (clear of the title bar and padding) */
function containerInnerOrigin(kind: ShapeKind): { x: number; y: number } {
  const padding = 14;
  if (kind === 'group') return { x: padding, y: 26 + padding };
  if (kind === 'swimlaneV') return { x: padding, y: SWIMLANE_HEADER_HEIGHT + padding };
  return { x: SWIMLANE_HEADER_WIDTH + padding, y: padding };
}

/** Run dagre once, returning each node's top-left corner */
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
 * Returns a new node array with rearranged positions (the input is not modified).
 * Child coordinates inside containers (swimlane / group) keep their "relative to parent" semantics.
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

  // Hierarchy preservation off: flatten and relayout everything (callers must absolute-ize child coordinates first)
  if (!preserveContainers) {
    const positions = dagreLayout(nodes, edges, direction, nodesep, ranksep);
    return nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position }));
  }

  const containers = nodes.filter((n) => !n.parentId && isContainerKind(n.data.kind));
  const childIds = new Set(nodes.filter((n) => n.parentId).map((n) => n.id));

  /** Container id → fitted size */
  const containerSize = new Map<string, { width: number; height: number }>();
  /** Node id → new relative/absolute coordinates */
  const innerPositions = new Map<string, { x: number; y: number }>();

  // 1) lay out inside each container + fit the container size
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

  // 2) lay out the top level (containers + free nodes)
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

  // 3) merge results: containers get their new size/position, children use container-inner coordinates, free nodes use top-level coordinates
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
