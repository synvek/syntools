/**
 * 基于 dagre 的层次化自动布局：把当前图重排为整齐的 TB / LR 流程。
 */

import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import { type FlowNodeData, shapeSize } from './model/types';

function sizeOf(node: Node<FlowNodeData>): { width: number; height: number } {
  if (node.width && node.height) return { width: node.width, height: node.height };
  if (node.measured && node.measured.width && node.measured.height) {
    return { width: node.measured.width, height: node.measured.height };
  }
  return shapeSize(node.data.kind);
}

/**
 * 返回位置被重排后的新节点数组（不修改入参）。
 * direction: 'TB' 自上而下，'LR' 自左向右。
 */
export function layoutGraph(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB',
): Node<FlowNodeData>[] {
  if (nodes.length === 0) return nodes;
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 48, ranksep: 64, marginx: 24, marginy: 24 });

  for (const node of nodes) {
    const size = sizeOf(node);
    g.setNode(node.id, size);
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    const size = sizeOf(node);
    return {
      ...node,
      position: {
        x: Math.round(pos.x - size.width / 2),
        y: Math.round(pos.y - size.height / 2),
      },
    };
  });
}
