import { layoutMindmap } from './layout';
import { visibleChildrenOf } from './tree';
import type { MindDoc } from './types';

/**
 * Sheet thumbnails, used when browsing multiple sheets.
 *
 * `sheetSceneOf(doc)` reuses the exact `layoutMindmap` output the canvas uses, so a thumbnail has
 * the same shape as the real canvas; `SheetThumbnail` merely draws it as SVG (inactive sheets are
 * not mounted in the DOM, so screenshots are not an option).
 */

export interface SheetSceneNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  depth: number;
}

export interface SheetSceneEdge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export interface SheetScene {
  width: number;
  height: number;
  nodes: SheetSceneNode[];
  edges: SheetSceneEdge[];
}

/**
 * One sheet → thumbnail scene.
 * Only visible nodes are laid out (collapsed branches are excluded, matching the canvas), which
 * keeps the thumbnail both faithful and cheap; returning null lets the caller show an empty state.
 */
export function sheetSceneOf(doc: MindDoc): SheetScene | null {
  const visible = new Set<string>();
  const walk = (id: string) => {
    visible.add(id);
    for (const child of visibleChildrenOf(doc.nodes, id)) walk(child.id);
  };
  walk(doc.rootId);
  const visibleNodes = doc.nodes.filter((node) => visible.has(node.id));
  if (visibleNodes.length === 0) return null;

  const layout = layoutMindmap({ ...doc, nodes: visibleNodes });
  if (layout.nodes.length === 0) return null;

  const byId = new Map(layout.nodes.map((node) => [node.id, node] as const));
  const nodes: SheetSceneNode[] = layout.nodes.map((node) => ({
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    color: node.color,
    depth: node.depth,
  }));

  const edges: SheetSceneEdge[] = [];
  for (const edge of layout.edges) {
    const from = byId.get(edge.source);
    const to = byId.get(edge.target);
    if (!from || !to) continue;
    // Matches the canvas: connect from the parent's right / left edge to the child's matching side
    const fromRight = to.x >= from.x;
    edges.push({
      id: edge.id,
      x1: fromRight ? from.x + from.width : from.x,
      y1: from.y + from.height / 2,
      x2: fromRight ? to.x : to.x + to.width,
      y2: to.y + to.height / 2,
      color: to.color,
    });
  }

  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));

  return {
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    nodes: nodes.map((node) => ({ ...node, x: node.x - minX, y: node.y - minY })),
    edges: edges.map((edge) => ({
      ...edge,
      x1: edge.x1 - minX,
      y1: edge.y1 - minY,
      x2: edge.x2 - minX,
      y2: edge.y2 - minY,
    })),
  };
}
