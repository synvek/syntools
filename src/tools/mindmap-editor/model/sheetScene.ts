import { layoutMindmap } from './layout';
import { visibleChildrenOf } from './tree';
import type { MindDoc } from './types';

/**
 * 画布（sheet）缩略图：多画布浏览用。
 *
 * `sheetSceneOf(doc)` 复用与画布完全一致的 `layoutMindmap` 布局结果，
 * 因此缩略图的形状与主画布一致；`SheetThumbnail` 只负责把它画成 SVG
 * （非活动画布并未挂到 DOM 上，无法用截图方案）。
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
 * 一张画布 → 缩略图场景。
 * 只布局「可见节点」（折叠分支不参与，与画布上的呈现一致），
 * 因此缩略图既忠实又便宜；返回 null 由调用方显示「空白画布」。
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
    // 与画布一致：从父节点右侧/左侧连到子节点对应侧
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
