import { absolutePositionOf } from '../core';
import { shapeSize } from './shapes';
import type { FlowPage } from './types';

/**
 * 页面缩略图：多页浏览用。
 *
 * 分两层，便于单测与复用：
 * 1. `pageSceneOf(page)` 纯函数：把一页的节点 / 连线归一成「包围盒 + 图元」，不碰 DOM；
 * 2. `PageThumbnail` 只是把图元画成 SVG —— 不走 DOM 截图（非活动页并未渲染），
 *    因此切换/预览任意页都很快。
 */

export interface SceneNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  /** 缩略图足够小，只区分「矩形 / 椭圆 / 菱形」三类轮廓 */
  shape: 'rect' | 'ellipse' | 'diamond';
  label: string;
}

export interface SceneEdge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed: boolean;
}

export interface PageScene {
  width: number;
  height: number;
  nodes: SceneNode[];
  edges: SceneEdge[];
}

function outlineOf(kind: string): SceneNode['shape'] {
  if (kind === 'ellipse' || kind === 'startEnd' || kind === 'terminator' || kind === 'display') {
    return 'ellipse';
  }
  if (kind === 'diamond' || kind === 'decision') return 'diamond';
  return 'rect';
}

/** 一页 → 缩略图场景；空页返回 null（由调用方显示「空白页」提示） */
export function pageSceneOf(page: FlowPage): PageScene | null {
  const visible = page.nodes.filter((node) => !node.hidden);
  if (visible.length === 0) return null;

  const byId = new Map(visible.map((node) => [node.id, node] as const));
  const nodes: SceneNode[] = [];
  for (const node of visible) {
    const position = absolutePositionOf(node, byId);
    const size = shapeSize(node.data.kind);
    const width = node.width ?? size.width;
    const height = node.height ?? size.height;
    const style = node.data.style;
    nodes.push({
      id: node.id,
      x: position.x,
      y: position.y,
      width,
      height,
      fill: style?.fill ?? '#ffffff',
      stroke: style?.stroke ?? '#94a3b8',
      shape: outlineOf(node.data.kind),
      label: node.data.label ?? '',
    });
  }

  // 连线画成「节点中心 → 节点中心」的直线：缩略图上足够表达走向
  const centerOf = (id: string) => {
    const node = nodes.find((item) => item.id === id);
    if (!node) return null;
    return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
  };
  const edges: SceneEdge[] = [];
  for (const edge of page.edges) {
    const from = centerOf(edge.source);
    const to = centerOf(edge.target);
    if (!from || !to) continue;
    edges.push({
      id: edge.id,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      dashed: edge.style?.dash !== undefined && edge.style.dash !== 'solid',
    });
  }

  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  return {
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    // 平移到原点，缩略图里再统一缩放
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
