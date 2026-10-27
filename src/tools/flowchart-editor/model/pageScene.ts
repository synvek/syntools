import { absolutePositionOf } from '../core';
import { shapeDefOf, shapeSize } from './shapes';
import type { FlowPage, ShapeKind } from './types';

/**
 * Page thumbnails: for multi-page browsing.
 *
 * Two layers, for easy unit-testing and reuse:
 * 1. `pageSceneOf(page)` is pure: normalizes a page's nodes / edges into "bounds + primitives" without touching the DOM;
 * 2. `PageThumbnail` merely draws those primitives as SVG — no DOM capture (inactive pages are not rendered),
 *    so switching and previewing any page stays fast.
 */

export interface SceneNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  /** Thumbnails are small enough to only distinguish three outlines: rectangle / ellipse / diamond */
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

function outlineOf(kind: ShapeKind): SceneNode['shape'] {
  // Driven by the catalog's draw, covering circle/ellipse/diamond kinds automatically (including UML use cases, pseudo-states, decisions, etc.)
  switch (shapeDefOf(kind)?.draw) {
    case 'ellipse':
    case 'circle':
      return 'ellipse';
    case 'diamond':
      return 'diamond';
    default:
      break;
  }
  // Fallback: capsules and sheared quadrilaterals are approximated as ellipses in thumbnails (preserving the legacy look)
  if (kind === 'startEnd' || kind === 'terminator' || kind === 'display') return 'ellipse';
  return 'rect';
}

/** One page → thumbnail scene; returns null for an empty page (callers show the "blank page" hint) */
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

  // Edges are drawn as straight "node center → node center" lines: enough to convey direction at thumbnail size
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
    // Translate to the origin, then scale uniformly in the thumbnail
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

/**
 * Memoized version of `pageSceneOf` (performance optimization).
 *
 * Thumbnails are recomputed repeatedly during editing; the nodes/edges array references of inactive pages stay stable
 * across document reads, so the cache maps "nodes array → { edges array, scene }": reused while the references hold,
 * invalidated automatically when the references change (the active page rebuilds them on every edit).
 * A WeakMap lets the cache be collected with the arrays, requiring no manual cleanup.
 */
const sceneCache = new WeakMap<object, { edges: object; scene: PageScene | null }>();

export function cachedPageSceneOf(page: FlowPage): PageScene | null {
  const key = page.nodes as unknown as object;
  const hit = sceneCache.get(key);
  if (hit && hit.edges === (page.edges as unknown as object)) return hit.scene;
  const scene = pageSceneOf(page);
  sceneCache.set(key, { edges: page.edges as unknown as object, scene });
  return scene;
}
