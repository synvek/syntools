/**
 * 流程图编辑器纯逻辑层：不引用 React Flow / DOM，便于单测与草稿序列化。
 * 约定：纯函数不向调用方抛异常，校验类返回布尔或 ToolResult。
 */

import {
  type Align,
  type FlowDoc,
  type FlowEdgeRec,
  type FlowEdgeStyle,
  type FlowNodeData,
  type FlowNodeRec,
  type FlowNodeStyle,
  type ShapeKind,
  type ShapeSize,
  isContainerKind,
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

/** 把内部状态序列化为可持久化的 v2 文档（当前为单页） */
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
  }>,
  edges: ReadonlyArray<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    label?: string;
    style?: FlowEdgeStyle;
  }>,
  pageName?: string,
): FlowDoc {
  const recNodes: FlowNodeRec[] = nodes.map((n) => ({
    id: n.id,
    type: 'shape',
    position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    parentId: n.parentId ?? null,
    width: n.width,
    height: n.height,
    hidden: n.hidden === true,
    locked: n.locked === true,
    data: {
      kind: n.data.kind,
      label: n.data.label,
      style: { ...n.data.style },
    },
  }));
  const recEdges: FlowEdgeRec[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
    label: e.label,
    style: e.style ? { ...e.style } : undefined,
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
