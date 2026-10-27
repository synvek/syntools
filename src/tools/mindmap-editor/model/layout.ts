/**
 * Mind map layout: a tidy-tree pass computes subtree spans post-order, then places nodes pre-order.
 * Three directions: right (rightward logic chart) / both (split left and right) / down (downward org chart).
 * Pure and O(n); outputs coordinates and branch edges that React Flow can consume directly.
 */

import { branchColorOf, themeOf } from './themes';
import { childrenOf, findNode, visibleChildrenOf } from './tree';
import type { MindDoc, MindNodeRec, MindSide } from './types';

/** Horizontal layout: level gap / sibling gap */
const H_GAP = 54;
const V_GAP = 14;
/** Downward layout: level gap / sibling gap */
const DOWN_V_GAP = 34;
const DOWN_H_GAP = 18;

/** Node horizontal padding (shape padding): compact, just enough to keep text off the edge */
const PAD_X = 20;
/** Text container padding (the span's px-2 in MindNode) */
const TEXT_PAD = 16;
/** Estimate compensation: prefer slightly wide over truncating text with an ellipsis */
const SAFETY = 6;
const MAX_WIDTH = 420;
const MIN_WIDTH = 76;

export interface MindLayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  side: MindSide;
  /** Main colour of the owning branch */
  color: string;
}

export interface MindLayoutEdge {
  id: string;
  source: string;
  target: string;
  color: string;
}

export interface MindBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MindLayoutResult {
  nodes: MindLayoutNode[];
  edges: MindLayoutEdge[];
  bounds: MindBounds;
}

/** Estimate text width: CJK counts full-width, the rest 0.6 em (avoids DOM measurement) */
export function measureTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const ch of text) {
    width += /[⺀-鿿＀-￯]/.test(ch) ? fontSize : fontSize * 0.6;
  }
  return width;
}

/** Node size: smaller deeper in the tree; width fits the text within min / max bounds */
export function nodeSizeOf(rec: MindNodeRec, depth: number): { width: number; height: number } {
  const fontSize = rec.style?.fontSize ?? (depth === 0 ? 16 : depth === 1 ? 14 : 13);
  const text = rec.text?.length ? rec.text : ' ';
  const raw = Math.ceil(measureTextWidth(text, fontSize) + PAD_X + TEXT_PAD + SAFETY);
  const width = Math.min(MAX_WIDTH, Math.max(depth === 0 ? 116 : MIN_WIDTH, raw));
  const height = depth === 0 ? 44 : depth === 1 ? 36 : 30;
  return { width, height };
}

interface Ctx {
  nodes: readonly MindNodeRec[];
  dir: MindDoc['direction'];
  size: Map<string, { width: number; height: number }>;
  color: Map<string, string>;
  depth: Map<string, number>;
  side: Map<string, MindSide>;
  span: Map<string, number>;
}

/** Span a subtree needs on the cross axis (height for horizontal layout, width for downward) */
function crossSizeOf(ctx: Ctx, id: string): number {
  const s = ctx.size.get(id);
  if (!s) return 0;
  return ctx.dir === 'down' ? s.width : s.height;
}

function childrenTotalOf(ctx: Ctx, id: string): number {
  const kids = visibleChildrenOf(ctx.nodes, id);
  if (kids.length === 0) return 0;
  const gap = ctx.dir === 'down' ? DOWN_H_GAP : V_GAP;
  let total = gap * (kids.length - 1);
  for (const k of kids) total += ctx.span.get(k.id) ?? crossSizeOf(ctx, k.id);
  return total;
}

function computeSpan(ctx: Ctx, id: string): number {
  const cached = ctx.span.get(id);
  if (cached !== undefined) return cached;
  const value = Math.max(crossSizeOf(ctx, id), childrenTotalOf(ctx, id));
  ctx.span.set(id, value);
  return value;
}

function computeSpans(ctx: Ctx, id: string): void {
  for (const child of visibleChildrenOf(ctx.nodes, id)) {
    computeSpans(ctx, child.id);
  }
  computeSpan(ctx, id);
}

/** Place in pre-order: `mainStart` is the node's start on the main axis (left/top for right/down, right edge for left) */
function place(
  ctx: Ctx,
  id: string,
  mainStart: number,
  crossStart: number,
  side: MindSide,
  out: MindLayoutNode[],
): void {
  const size = ctx.size.get(id);
  if (!size) return;
  const span = ctx.span.get(id) ?? crossSizeOf(ctx, id);
  const center = crossStart + span / 2;
  const depth = ctx.depth.get(id) ?? 0;
  let x: number;
  let y: number;
  let childMain: number;

  if (ctx.dir === 'down') {
    x = center - size.width / 2;
    y = mainStart;
    childMain = y + size.height + DOWN_V_GAP;
  } else if (side === 'right') {
    x = mainStart;
    y = center - size.height / 2;
    childMain = x + size.width + H_GAP;
  } else {
    x = mainStart - size.width;
    y = center - size.height / 2;
    childMain = x - H_GAP;
  }

  out.push({
    id,
    x: Math.round(x),
    y: Math.round(y),
    width: size.width,
    height: size.height,
    depth,
    side,
    color: ctx.color.get(id) ?? '#2563EB',
  });

  const kids = visibleChildrenOf(ctx.nodes, id);
  if (kids.length === 0) return;
  const gap = ctx.dir === 'down' ? DOWN_H_GAP : V_GAP;
  // Centre the whole subtree within the parent's span so the parent faces the child cluster
  let cursor = crossStart + (span - childrenTotalOf(ctx, id)) / 2;
  for (const child of kids) {
    const childSpan = ctx.span.get(child.id) ?? crossSizeOf(ctx, child.id);
    place(ctx, child.id, childMain, cursor, side, out);
    cursor += childSpan + gap;
  }
}

/** Compute coordinates for the whole tree (top-right origin, then normalised to start at 0,0) */
export function layoutMindmap(doc: MindDoc): MindLayoutResult {
  const root = findNode(doc.nodes, doc.rootId);
  if (!root) return { nodes: [], edges: [], bounds: { x: 0, y: 0, width: 0, height: 0 } };

  const theme = themeOf(doc.themeId);
  const ctx: Ctx = {
    nodes: doc.nodes,
    dir: doc.direction,
    size: new Map(),
    color: new Map(),
    depth: new Map(),
    side: new Map(),
    span: new Map(),
  };

  // Depth / branch colour / side: one pre-order pass
  const assign = (id: string, depth: number, color: string, side: MindSide, index: number) => {
    const rec = findNode(doc.nodes, id);
    if (!rec) return;
    const own = depth === 0 ? theme.root.fill : depth === 1 ? branchColorOf(theme, index) : color;
    ctx.depth.set(id, depth);
    ctx.color.set(id, rec.color ?? own);
    ctx.side.set(id, side);
    ctx.size.set(id, nodeSizeOf(rec, depth));
    const kids = childrenOf(doc.nodes, id);
    kids.forEach((child, i) => {
      const childSide: MindSide =
        depth === 0 && doc.direction === 'both'
          ? (child.side ?? (i % 2 === 0 ? 'right' : 'left'))
          : side;
      assign(child.id, depth + 1, ctx.color.get(id) ?? own, childSide, i);
    });
  };
  assign(root.id, 0, theme.root.fill, 'right', 0);

  computeSpans(ctx, root.id);

  const out: MindLayoutNode[] = [];
  const rootSize = ctx.size.get(root.id) ?? { width: 120, height: 52 };
  const rootKids = visibleChildrenOf(doc.nodes, root.id);

  if (doc.direction === 'both' && rootKids.length > 0) {
    // Left / right groups: each is centred on the root, so they never overlap horizontally
    const left = rootKids.filter((k) => ctx.side.get(k.id) === 'left');
    const right = rootKids.filter((k) => ctx.side.get(k.id) === 'right');
    const spanOf = (list: MindNodeRec[]) =>
      list.length === 0
        ? 0
        : list.reduce((s, k) => s + (ctx.span.get(k.id) ?? 0), 0) + V_GAP * (list.length - 1);
    const sideSpan = Math.max(spanOf(left), spanOf(right), rootSize.height);
    const rootY = (sideSpan - rootSize.height) / 2;
    out.push({
      id: root.id,
      x: 0,
      y: Math.round(rootY),
      width: rootSize.width,
      height: rootSize.height,
      depth: 0,
      side: 'right',
      color: ctx.color.get(root.id) ?? theme.root.fill,
    });
    const center = rootY + rootSize.height / 2;
    const placeSide = (list: MindNodeRec[], side: MindSide, mainStart: number) => {
      let cursor = center - spanOf(list) / 2;
      for (const child of list) {
        const childSpan = ctx.span.get(child.id) ?? 0;
        place(ctx, child.id, mainStart, cursor, side, out);
        cursor += childSpan + V_GAP;
      }
    };
    placeSide(right, 'right', rootSize.width + H_GAP);
    placeSide(left, 'left', -H_GAP);
  } else {
    place(ctx, root.id, 0, 0, 'right', out);
  }

  const edges: MindLayoutEdge[] = [];
  const known = new Set(out.map((n) => n.id));
  for (const rec of doc.nodes) {
    if (!rec.parentId || !known.has(rec.id) || !known.has(rec.parentId)) continue;
    edges.push({
      id: `e-${rec.parentId}-${rec.id}`,
      source: rec.parentId,
      target: rec.id,
      color: ctx.color.get(rec.id) ?? '#2563EB',
    });
  }

  // Normalise: shift everything to (0,0) for fitView and export
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of out) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  if (!Number.isFinite(minX))
    return { nodes: [], edges: [], bounds: { x: 0, y: 0, width: 0, height: 0 } };
  for (const n of out) {
    n.x -= minX;
    n.y -= minY;
  }
  return {
    nodes: out,
    edges,
    bounds: { x: 0, y: 0, width: Math.round(maxX - minX), height: Math.round(maxY - minY) },
  };
}
