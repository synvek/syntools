/**
 * 流程图编辑器纯逻辑层：不引用 React Flow / DOM，便于单测与草稿序列化。
 * 约定：纯函数不向调用方抛异常，校验类返回布尔或 ToolResult。
 */

import {
  type Align,
  type EdgeLabelPosition,
  type FlowDoc,
  type FlowEdgeRec,
  type FlowEdgeStyle,
  type FlowNodeData,
  type FlowNodeRec,
  type FlowNodeStyle,
  type FlowNodeType,
  type ShapeKind,
  type ShapeSize,
  type Waypoint,
  isContainerKind,
  minNodeSize,
} from './model/types';
import { shapeDefOf, shapeSize } from './model/shapes';
import { migrateDoc, toDocV2 } from './model/migrate';

let idCounter = 0;

/** 生成稳定且唯一的节点/连线 id（不依赖随机，便于测试） */
export function createId(prefix = 'n'): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

/** 归一化 #RRGGBB 色值；非法输入回退为 fallback */
export function normalizeColor(input: string | undefined | null, fallback = '#000000'): string {
  if (!input) return fallback;
  const text = input.trim().replace(/^#/, '');
  const full = /^[0-9a-fA-F]{3}$/.test(text)
    ? text
        .split('')
        .map((c) => c + c)
        .join('')
    : text;
  if (/^[0-9a-fA-F]{6}$/.test(full)) return `#${full.toLowerCase()}`;
  return fallback;
}

/* --------------------------- 节点变换（旋转 / 镜像） --------------------------- */

/** 把任意角度归一到 [0, 360) */
export function normalizeRotation(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

/** 把角度吸附到步长倍数（step <= 0 时归一到整数度） */
export function snapRotation(deg: number, step: number): number {
  const base = normalizeRotation(deg);
  if (!Number.isFinite(step) || step <= 0) return Math.round(base);
  return normalizeRotation(Math.round(base / step) * step);
}

/**
 * 由「中心点 + 指针位置」求角度（度，0=正右方，顺时针增大）。
 * 手柄渲染与拖拽共用，保证几何一致。
 */
export function angleFromCenter(cx: number, cy: number, px: number, py: number): number {
  return normalizeRotation((Math.atan2(py - cy, px - cx) * 180) / Math.PI);
}

/**
 * 节点变换的 CSS transform（旋转 + 镜像）。
 * 以包围盒中心为原点；无变换时返回 undefined，避免无谓的合成层。
 */
export function nodeTransformCss(style: Partial<FlowNodeStyle> | undefined): string | undefined {
  const rotation = normalizeRotation(style?.rotation ?? 0);
  const sx = style?.flipH === true ? -1 : 1;
  const sy = style?.flipV === true ? -1 : 1;
  const parts: string[] = [];
  if (rotation !== 0) parts.push(`rotate(${round(rotation, 3)}deg)`);
  if (sx !== 1 || sy !== 1) parts.push(`scale(${sx}, ${sy})`);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/* --------------------------- 容器缩放联动 --------------------------- */

/** 容器缩放后子节点的换算结果 */
export interface ScaledChild {
  id: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
}

/**
 * 容器（泳道 / 编组）缩放时按比例换算子节点的相对坐标与尺寸。
 *
 * 子节点坐标是相对容器的，因此直接按缩放比换算即可保持视觉布局；
 * 尺寸按同一比例缩放并夹取到各自的最小尺寸，避免缩小时把子节点压成不可见。
 * 尺寸未变化、或比例非法时返回空数组（调用方据此跳过写入）。
 */
export function scaleChildren(
  children: ReadonlyArray<{
    id: string;
    kind: ShapeKind;
    position: { x: number; y: number };
    width?: number;
    height?: number;
  }>,
  prev: ShapeSize,
  next: ShapeSize,
): ScaledChild[] {
  if (children.length === 0) return [];
  if (prev.width <= 0 || prev.height <= 0 || next.width <= 0 || next.height <= 0) return [];
  const sx = next.width / prev.width;
  const sy = next.height / prev.height;
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return [];
  if (Math.abs(sx - 1) < 1e-6 && Math.abs(sy - 1) < 1e-6) return [];
  return children.map((child) => {
    const min = minNodeSize(child.kind);
    const base = shapeSize(child.kind);
    const width = child.width ?? base.width;
    const height = child.height ?? base.height;
    return {
      id: child.id,
      position: {
        x: Math.round(child.position.x * sx),
        y: Math.round(child.position.y * sy),
      },
      width: Math.max(min.width, Math.round(width * sx)),
      height: Math.max(min.height, Math.round(height * sy)),
    };
  });
}

/**
 * 超链接协议白名单：仅放行 http / https / mailto，其余（含 javascript:）视为无效。
 * 返回可直接用于 href 的字符串；无效返回 undefined。
 */
export function safeLinkHref(link: string | undefined): string | undefined {
  if (!link) return undefined;
  const trimmed = link.trim();
  if (!trimmed) return undefined;
  // 无协议时按 https 补全，便于用户只输入域名
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  return /^(https?|mailto):/i.test(withScheme) ? withScheme : undefined;
}

export const DEFAULT_STYLE: FlowNodeStyle = {
  fill: '#EFF6FF',
  stroke: '#2563EB',
  strokeWidth: 2,
  fontSize: 13,
  bold: false,
  italic: false,
  align: 'center',
};

/**
 * 各形状的基础配色（配色统一登记在图形目录，新增形状无需改这里）。
 * 默认文本为空串：新建图形不带任何文案，避免出现与用户无关的占位文字。
 */
export function defaultData(kind: ShapeKind, label = ''): FlowNodeData {
  const base: FlowNodeStyle = { ...DEFAULT_STYLE };
  const def = shapeDefOf(kind);
  if (def?.defaultStyle) Object.assign(base, def.defaultStyle);
  if (isContainerKind(kind)) base.align = 'left';
  return { kind, label, style: base };
}

/** 图标节点数据（颜色取 stroke，其余绘制由 IconNode 决定） */
export function iconData(iconId: string, label = ''): FlowNodeData {
  return {
    kind: 'rect',
    label,
    iconId,
    style: { ...DEFAULT_STYLE, fill: '#FFFFFF', stroke: '#0F172A', strokeWidth: 0, fontSize: 12 },
  };
}

/** 图片节点数据（dataURL 直接内联，不离开浏览器） */
export function imageData(src: string, label = ''): FlowNodeData {
  return {
    kind: 'rect',
    label,
    src,
    style: { ...DEFAULT_STYLE, fill: '#FFFFFF', stroke: '#CBD5E1', strokeWidth: 1, fontSize: 12 },
  };
}

/** 公式节点数据（LaTeX 源码，渲染时动态加载 KaTeX） */
export function formulaData(formula: string, label = ''): FlowNodeData {
  return {
    kind: 'rect',
    label,
    formula,
    style: { ...DEFAULT_STYLE, fill: '#FFFFFF', stroke: '#0F172A', strokeWidth: 0, fontSize: 16 },
  };
}

/* --------------------------- 对齐辅助线 --------------------------- */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HelperLines {
  /** 拖拽节点的吸附后 x（未吸附则为 undefined） */
  x?: number;
  /** 吸附后 y */
  y?: number;
  /** 竖直参考线的画布 x 坐标 */
  vertical?: number;
  /** 水平参考线的画布 y 坐标 */
  horizontal?: number;
  /** 竖直参考线是否为中心点对齐（用于区分样式） */
  verticalCenter?: boolean;
  /** 水平参考线是否为中心点对齐 */
  horizontalCenter?: boolean;
}

interface Bounds {
  left: number;
  right: number;
  centerX: number;
  top: number;
  bottom: number;
  centerY: number;
}

function toBounds(r: Rect): Bounds {
  return {
    left: r.x,
    right: r.x + r.width,
    centerX: r.x + r.width / 2,
    top: r.y,
    bottom: r.y + r.height,
    centerY: r.y + r.height / 2,
  };
}

/**
 * 计算拖拽节点与其它节点的吸附落点与参考线坐标。
 * 比较「左/右/中」三条轴与「上/下/中」三条轴，距差 ≤ tolerance 时吸附。
 */
export function computeHelperLines(dragging: Rect, others: Rect[], tolerance = 5): HelperLines {
  const db = toBounds(dragging);
  let minX = tolerance;
  let minY = tolerance;
  const result: HelperLines = {};

  for (const other of others) {
    const ob = toBounds(other);
    // [目标坐标, 拖拽方坐标, 是否中心对齐]
    const xPairs: Array<[number, number, boolean]> = [
      [ob.left, db.left, false],
      [ob.right, db.left, false],
      [ob.centerX, db.left, false],
      [ob.left, db.right, false],
      [ob.right, db.right, false],
      [ob.centerX, db.right, false],
      [ob.left, db.centerX, true],
      [ob.right, db.centerX, true],
      [ob.centerX, db.centerX, true],
    ];
    for (const [target, moving, isCenter] of xPairs) {
      const dist = Math.abs(target - moving);
      if (dist < minX) {
        minX = dist;
        result.x = dragging.x + (target - moving);
        result.vertical = target;
        result.verticalCenter = isCenter;
      }
    }
    const yPairs: Array<[number, number, boolean]> = [
      [ob.top, db.top, false],
      [ob.bottom, db.top, false],
      [ob.centerY, db.top, false],
      [ob.top, db.bottom, false],
      [ob.bottom, db.bottom, false],
      [ob.centerY, db.bottom, false],
      [ob.top, db.centerY, true],
      [ob.bottom, db.centerY, true],
      [ob.centerY, db.centerY, true],
    ];
    for (const [target, moving, isCenter] of yPairs) {
      const dist = Math.abs(target - moving);
      if (dist < minY) {
        minY = dist;
        result.y = dragging.y + (target - moving);
        result.horizontal = target;
        result.horizontalCenter = isCenter;
      }
    }
  }
  return result;
}

/* --------------------------- 容器（泳道）层级 --------------------------- */

/** 参与层级计算的最小节点形状 */
export interface HierarchyNode {
  id: string;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
  parentId?: string | null;
  data: { kind: ShapeKind };
}

function nodeSize(node: HierarchyNode): ShapeSize {
  return {
    width: node.width ?? shapeSize(node.data.kind).width,
    height: node.height ?? shapeSize(node.data.kind).height,
  };
}

/** 计算节点在画布坐标系中的绝对位置（叠加父节点偏移） */
export function absolutePositionOf<T extends HierarchyNode>(
  node: T,
  byId: Map<string, T>,
): { x: number; y: number } {
  if (!node.parentId) return { x: node.position.x, y: node.position.y };
  const parent = byId.get(node.parentId);
  if (!parent) return { x: node.position.x, y: node.position.y };
  const base = absolutePositionOf(parent, byId);
  return { x: base.x + node.position.x, y: base.y + node.position.y };
}

/** 节点在画布坐标系中的绝对包围盒 */
export function absoluteRectOf<T extends HierarchyNode>(node: T, byId: Map<string, T>): Rect {
  const pos = absolutePositionOf(node, byId);
  const size = nodeSize(node);
  return { x: pos.x, y: pos.y, width: size.width, height: size.height };
}

/**
 * 绝对包围盒的记忆化版本（性能优化）。
 *
 * 拖拽辅助线每帧都要对同页大量节点求包围盒；未移动的节点对象引用不变，
 * 其父节点对象引用同样不变，因此可复用上一帧结果。
 * 缓存以「节点对象 → { 父对象, 包围盒 }」组成：父节点移动会产生新的父对象引用，
 * 缓存自动失效，避免容器拖动后子节点包围盒过期。
 * WeakMap 使缓存随节点对象回收，无需手动清理。
 */
const rectCache = new WeakMap<object, { parent: object | null; rect: Rect }>();

export function cachedAbsoluteRectOf<T extends HierarchyNode>(node: T, byId: Map<string, T>): Rect {
  const parent = node.parentId ? (byId.get(node.parentId) ?? null) : null;
  const key = node as unknown as object;
  const hit = rectCache.get(key);
  if (hit && hit.parent === (parent as unknown as object | null)) return hit.rect;
  const rect = absoluteRectOf(node, byId);
  rectCache.set(key, { parent: parent as unknown as object | null, rect });
  return rect;
}

export interface Placement {
  /** 命中泳道时为其 id；否则为 undefined（画布顶层） */
  parentId?: string;
  /** 命中泳道时为相对坐标，否则为绝对坐标 */
  position: { x: number; y: number };
}

/**
 * 判断元素落点是否位于某个泳道内：
 * 命中则返回泳道 id 与相对坐标，否则原样返回绝对坐标。
 * 多条泳道重叠时取面积最小者。
 */
export function resolvePlacement(
  rect: Rect,
  lanes: ReadonlyArray<{ id: string; rect: Rect }>,
): Placement {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  let hit: { id: string; rect: Rect } | undefined;
  for (const lane of lanes) {
    const r = lane.rect;
    if (cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height) {
      if (!hit || r.width * r.height < hit.rect.width * hit.rect.height) hit = lane;
    }
  }
  if (!hit) return { position: { x: rect.x, y: rect.y } };
  return {
    parentId: hit.id,
    position: { x: rect.x - hit.rect.x, y: rect.y - hit.rect.y },
  };
}

/**
 * 排序：泳道（容器）最底层 → 其它顶层节点 → 子节点。
 * React Flow 要求父节点在数组中先于子节点，且数组顺序决定堆叠层级。
 */
export function orderNodesByHierarchy<T extends HierarchyNode>(nodes: readonly T[]): T[] {
  const lanes: T[] = [];
  const tops: T[] = [];
  const children: T[] = [];
  for (const n of nodes) {
    if (n.parentId) children.push(n);
    else if (isContainerKind(n.data.kind)) lanes.push(n);
    else tops.push(n);
  }
  return [...lanes, ...tops, ...children];
}

export type AnchorSide = 't' | 'b' | 'l' | 'r';

/** 锚点 id → 图形内的相对位置（与 ShapeNode 的 HANDLES 保持一致） */
const HANDLE_ANCHORS: Record<string, { fx: number; fy: number }> = {
  't-l': { fx: 0.25, fy: 0 },
  t: { fx: 0.5, fy: 0 },
  't-r': { fx: 0.75, fy: 0 },
  'b-l': { fx: 0.25, fy: 1 },
  b: { fx: 0.5, fy: 1 },
  'b-r': { fx: 0.75, fy: 1 },
  l: { fx: 0, fy: 0.5 },
  r: { fx: 1, fy: 0.5 },
};

/**
 * 连线端点在画布坐标系中的位置与所在边。
 * 无锚点信息（导入数据 / 自由连线）时，取朝向对端的一侧中点。
 */
export function anchorOf<T extends HierarchyNode>(
  node: T,
  byId: Map<string, T>,
  handleId?: string | null,
  other?: T,
): { point: { x: number; y: number }; side: AnchorSide } {
  const rect = absoluteRectOf(node, byId);
  const anchor = handleId ? HANDLE_ANCHORS[handleId] : undefined;
  if (anchor) {
    const side: AnchorSide =
      anchor.fy === 0 ? 't' : anchor.fy === 1 ? 'b' : anchor.fx === 0 ? 'l' : 'r';
    return {
      point: { x: rect.x + rect.width * anchor.fx, y: rect.y + rect.height * anchor.fy },
      side,
    };
  }
  const otherRect = other ? absoluteRectOf(other, byId) : rect;
  const dx = otherRect.x + otherRect.width / 2 - (rect.x + rect.width / 2);
  const dy = otherRect.y + otherRect.height / 2 - (rect.y + rect.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { point: { x: rect.x + rect.width, y: rect.y + rect.height / 2 }, side: 'r' }
      : { point: { x: rect.x, y: rect.y + rect.height / 2 }, side: 'l' };
  }
  return dy >= 0
    ? { point: { x: rect.x + rect.width / 2, y: rect.y + rect.height }, side: 'b' }
    : { point: { x: rect.x + rect.width / 2, y: rect.y }, side: 't' };
}

/** 从锚点沿所在边法线方向外推一段距离（正交路由的起止「短桩」） */
export function stubPoint(
  point: { x: number; y: number },
  side: AnchorSide,
  distance = 24,
): { x: number; y: number } {
  switch (side) {
    case 't':
      return { x: point.x, y: point.y - distance };
    case 'b':
      return { x: point.x, y: point.y + distance };
    case 'l':
      return { x: point.x - distance, y: point.y };
    default:
      return { x: point.x + distance, y: point.y };
  }
}

/* --------------------------- 序列化 / 校验 --------------------------- */

export interface SerializeResult {
  ok: boolean;
  doc?: FlowDoc;
  error?: string;
}

/** 宽松校验：能归一为 v2 即视为合法（兼容旧版 v1 文档） */
export function validateDoc(raw: unknown): raw is FlowDoc {
  return migrateDoc(raw) !== null;
}

/** 把内部状态序列化为可持久化的 v2 文档（单页记录；多页由 store 按页组装） */
export function serializeDoc(
  nodes: ReadonlyArray<{
    id: string;
    position: { x: number; y: number };
    parentId?: string | null;
    data: FlowNodeData;
    width?: number;
    height?: number;
    hidden?: boolean;
    locked?: boolean;
    /** 节点类型（缺省视为图形节点，兼容旧文档） */
    type?: FlowNodeType;
    mxStyle?: string[];
  }>,
  edges: ReadonlyArray<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    label?: string;
    sourceLabel?: string;
    targetLabel?: string;
    labelPosition?: EdgeLabelPosition;
    style?: FlowEdgeStyle;
    waypoints?: Waypoint[];
    mxStyle?: string[];
  }>,
  pageName?: string,
): FlowDoc {
  const recNodes: FlowNodeRec[] = nodes.map((n) => ({
    id: n.id,
    type: n.type ?? 'shape',
    position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    parentId: n.parentId ?? null,
    width: n.width,
    height: n.height,
    hidden: n.hidden === true,
    locked: n.locked === true,
    ...(n.mxStyle && n.mxStyle.length > 0 ? { mxStyle: [...n.mxStyle] } : {}),
    data: {
      kind: n.data.kind,
      label: n.data.label,
      style: { ...n.data.style },
      ...(n.data.collapsed ? { collapsed: true } : {}),
      ...(n.data.src ? { src: n.data.src } : {}),
      ...(n.data.iconId ? { iconId: n.data.iconId } : {}),
      ...(n.data.formula ? { formula: n.data.formula } : {}),
    },
  }));
  const recEdges: FlowEdgeRec[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
    label: e.label,
    ...(e.sourceLabel ? { sourceLabel: e.sourceLabel } : {}),
    ...(e.targetLabel ? { targetLabel: e.targetLabel } : {}),
    ...(e.labelPosition ? { labelPosition: e.labelPosition } : {}),
    style: e.style ? { ...e.style } : undefined,
    ...(e.waypoints && e.waypoints.length > 0
      ? { waypoints: e.waypoints.map((p) => ({ x: p.x, y: p.y })) }
      : {}),
    ...(e.mxStyle && e.mxStyle.length > 0 ? { mxStyle: [...e.mxStyle] } : {}),
  }));
  return toDocV2(recNodes, recEdges, pageName);
}

/** 反序列化并归一为 v2；非法返回 { ok:false }，调用方降级为空图 */
export function deserializeDoc(raw: unknown): SerializeResult {
  const doc = migrateDoc(raw);
  if (!doc) return { ok: false, error: 'INVALID_DOC' };
  return { ok: true, doc };
}

/* 模板已迁移到 `./model/templates`（按图种分类的模板库） */

/** 仅暴露给测试：用于重置内部计数器 */
export function __resetIdCounter(): void {
  idCounter = 0;
}

export type { Align };
