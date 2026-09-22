/**
 * 脑图布局：tidy-tree 后序计算子树跨度 → 先序落位。
 * 三种方向：right（向右逻辑图）/ both（左右两侧分布）/ down（向下组织图）。
 * 纯函数、O(n)，输出 React Flow 可直接使用的坐标与分支连线。
 */

import { branchColorOf, themeOf } from './themes';
import { childrenOf, findNode, visibleChildrenOf } from './tree';
import type { MindDoc, MindNodeRec, MindSide } from './types';

/** 水平布局：层间距 / 同层间距 */
const H_GAP = 54;
const V_GAP = 14;
/** 向下布局：层间距 / 同层间距 */
const DOWN_V_GAP = 34;
const DOWN_H_GAP = 18;

/** 节点左右留白（形状内边距）：紧凑风格，仅够不贴边 */
const PAD_X = 20;
/** 文本容器内边距（对应 MindNode 里 span 的 px-2） */
const TEXT_PAD = 16;
/** 估算误差补偿：宁可略宽也不要把文本截成省略号 */
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
  /** 所属分支主色 */
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

/** 文本宽度估算：中文按全角计，其余按 0.6 字宽计（避免依赖 DOM 测量） */
export function measureTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const ch of text) {
    width += /[⺀-鿿＀-￯]/.test(ch) ? fontSize : fontSize * 0.6;
  }
  return width;
}

/** 节点尺寸：层级越深越小；宽度随文本自适应并做上下限约束 */
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

/** 子树在「交叉轴」上需要的跨度（水平布局 = 高度方向，向下布局 = 宽度方向） */
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

/** 先序落位：mainStart 为该节点在主轴上的起点（right/down 为左/上边，left 为右边） */
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
  // 子树整体在父节点跨度内居中，保证父节点正对子节点群中心
  let cursor = crossStart + (span - childrenTotalOf(ctx, id)) / 2;
  for (const child of kids) {
    const childSpan = ctx.span.get(child.id) ?? crossSizeOf(ctx, child.id);
    place(ctx, child.id, childMain, cursor, side, out);
    cursor += childSpan + gap;
  }
}

/** 计算整棵树的坐标（右上角为 0 基准，随后归一化为 0,0 起点） */
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

  // 深度 / 分支色 / 侧别：先序遍历一次
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
    // 左右分组：两组各自居中于根节点中心，水平方向互不干扰
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

  // 归一化：整体平移到 (0,0)，便于 fitView 与导出
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
