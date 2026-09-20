/**
 * 流程图编辑器纯逻辑层：不引用 React Flow / DOM，便于单测与草稿序列化。
 * 约定：纯函数不向调用方抛异常，校验类返回布尔或 ToolResult。
 */

import {
  type Align,
  type FlowDoc,
  type FlowNodeData,
  type FlowNodeStyle,
  type ShapeKind,
  type ShapeSize,
  isContainerKind,
  shapeSize,
  SHAPE_LABELS,
} from './model/types';

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

/** 各形状的默认标签与基础样式微调 */
export function defaultData(kind: ShapeKind, label?: string): FlowNodeData {
  const base: FlowNodeStyle = { ...DEFAULT_STYLE };
  if (kind === 'startEnd') {
    base.fill = '#ECFDF5';
    base.stroke = '#16A34A';
  } else if (kind === 'decision') {
    base.fill = '#FEFCE8';
    base.stroke = '#D97706';
  } else if (isContainerKind(kind)) {
    base.fill = '#F8FAFC';
    base.stroke = '#475569';
    base.align = 'left';
  } else if (kind === 'bpmnTask') {
    base.fill = '#FDF2F8';
    base.stroke = '#DB2777';
  }
  return {
    kind,
    label: label ?? SHAPE_LABELS[kind],
    style: base,
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
    const xPairs: Array<[number, number]> = [
      [ob.left, db.left],
      [ob.right, db.left],
      [ob.centerX, db.left],
      [ob.left, db.right],
      [ob.right, db.right],
      [ob.centerX, db.right],
      [ob.left, db.centerX],
      [ob.right, db.centerX],
      [ob.centerX, db.centerX],
    ];
    for (const [target, moving] of xPairs) {
      const dist = Math.abs(target - moving);
      if (dist < minX) {
        minX = dist;
        result.x = dragging.x + (target - moving);
        result.vertical = target;
      }
    }
    const yPairs: Array<[number, number]> = [
      [ob.top, db.top],
      [ob.bottom, db.top],
      [ob.centerY, db.top],
      [ob.top, db.bottom],
      [ob.bottom, db.bottom],
      [ob.centerY, db.bottom],
      [ob.top, db.centerY],
      [ob.bottom, db.centerY],
      [ob.centerY, db.centerY],
    ];
    for (const [target, moving] of yPairs) {
      const dist = Math.abs(target - moving);
      if (dist < minY) {
        minY = dist;
        result.y = dragging.y + (target - moving);
        result.horizontal = target;
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

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** 宽松校验一个对象是否为合法 FlowDoc */
export function validateDoc(raw: unknown): raw is FlowDoc {
  if (!raw || typeof raw !== 'object') return false;
  const doc = raw as Partial<FlowDoc>;
  if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) return false;
  for (const node of doc.nodes) {
    if (!node || typeof node.id !== 'string') return false;
    if (!node.position || !isFiniteNum(node.position.x) || !isFiniteNum(node.position.y))
      return false;
    if (!node.data || typeof node.data.kind !== 'string' || typeof node.data.label !== 'string')
      return false;
    if (!node.data.style || typeof node.data.style.fill !== 'string') return false;
    if (node.parentId != null && typeof node.parentId !== 'string') return false;
  }
  for (const edge of doc.edges) {
    if (!edge || typeof edge.id !== 'string') return false;
    if (typeof edge.source !== 'string' || typeof edge.target !== 'string') return false;
  }
  return true;
}

/** 把内部状态序列化为可持久化的 FlowDoc（version 自增） */
export function serializeDoc(
  nodes: ReadonlyArray<{
    id: string;
    position: { x: number; y: number };
    parentId?: string | null;
    data: FlowNodeData;
  }>,
  edges: ReadonlyArray<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    label?: string;
  }>,
  version = 1,
): FlowDoc {
  return {
    version,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: 'shape',
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      parentId: n.parentId ?? null,
      data: {
        kind: n.data.kind,
        label: n.data.label,
        style: { ...n.data.style },
      },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      label: e.label,
    })),
  };
}

/** 反序列化并校验；非法返回 { ok:false }，调用方降级为空图 */
export function deserializeDoc(raw: unknown): SerializeResult {
  if (!validateDoc(raw)) return { ok: false, error: 'INVALID_DOC' };
  return { ok: true, doc: raw as FlowDoc };
}

/* --------------------------- 模板 --------------------------- */

export type TemplateKind = 'basic' | 'decision' | 'swimlane' | 'swimlaneV' | 'bpmn';

/**
 * 生成起始模板图（节点位置基于 shapeSize 居中排布）。
 * 返回全新 id，避免与现有图冲突。
 */
export function buildTemplate(kind: TemplateKind): FlowDoc {
  const nodes: FlowDoc['nodes'] = [];
  const edges: FlowDoc['edges'] = [];
  const add = (n: ShapeKind, label: string, x: number, y: number): string => {
    const id = createId('t');
    nodes.push({
      id,
      type: 'shape',
      position: { x, y },
      data: defaultData(n, label),
    });
    return id;
  };
  const link = (source: string, target: string) =>
    edges.push({ id: createId('te'), source, target });

  if (kind === 'basic') {
    const a = add('startEnd', '开始', 240, 40);
    const b = add('rect', '处理步骤', 215, 140);
    const c = add('rect', '处理步骤', 215, 240);
    const d = add('startEnd', '结束', 240, 340);
    link(a, b);
    link(b, c);
    link(c, d);
  } else if (kind === 'decision') {
    const a = add('startEnd', '开始', 260, 40);
    const b = add('decision', '条件成立?', 235, 140);
    const c = add('rect', '分支 A', 80, 280);
    const e = add('rect', '分支 B', 410, 280);
    const f = add('startEnd', '结束', 260, 380);
    link(a, b);
    link(b, c);
    link(b, e);
    link(c, f);
    link(e, f);
  } else if (kind === 'swimlane') {
    // 标准横向泳道：泳道绝对位于 (60,60)，内部元素坐标相对泳道
    const lane = add('swimlane', '横向泳道', 60, 60);
    const addChild = (n: ShapeKind, label: string, x: number, y: number): string => {
      const id = createId('t');
      nodes.push({
        id,
        type: 'shape',
        position: { x, y },
        parentId: lane,
        data: defaultData(n, label),
      });
      return id;
    };
    const a = addChild('startEnd', '开始', 50, 82);
    const b = addChild('rect', '步骤 1', 220, 78);
    const c = addChild('rect', '步骤 2', 410, 78);
    const d = addChild('startEnd', '结束', 600, 82);
    link(a, b);
    link(b, c);
    link(c, d);
  } else if (kind === 'swimlaneV') {
    // 标准纵向泳道：泳道绝对位于 (60,60)，标题栏在左侧，内部元素纵向排列
    const lane = add('swimlaneV', '纵向泳道', 60, 60);
    const addChild = (n: ShapeKind, label: string, x: number, y: number): string => {
      const id = createId('t');
      nodes.push({
        id,
        type: 'shape',
        position: { x, y },
        parentId: lane,
        data: defaultData(n, label),
      });
      return id;
    };
    const a = addChild('startEnd', '开始', 55, 65);
    const b = addChild('rect', '步骤 1', 45, 170);
    const c = addChild('rect', '步骤 2', 45, 300);
    const d = addChild('startEnd', '结束', 55, 430);
    link(a, b);
    link(b, c);
    link(c, d);
  } else {
    // bpmn
    const a = add('bpmnTask', '开始事件', 235, 40);
    const b = add('bpmnTask', '用户任务', 220, 150);
    const c = add('bpmnTask', '服务任务', 220, 250);
    const d = add('bpmnTask', '结束事件', 235, 360);
    link(a, b);
    link(b, c);
    link(c, d);
  }

  return { version: 1, nodes, edges };
}

/** 仅暴露给测试：用于重置内部计数器 */
export function __resetIdCounter(): void {
  idCounter = 0;
}

export type { Align };
