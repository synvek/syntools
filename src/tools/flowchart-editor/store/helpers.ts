/**
 * store 内部共享工具：节点/边构造、页面记录 ↔ React Flow 节点互转、选择归一化。
 * 从 `store.ts` 下沉，保持纯函数、便于单测与复用。
 */

import type { Connection, Edge, Node } from '@xyflow/react';
import { i18n } from '@/core/i18n';
import { createId, defaultData, orderNodesByHierarchy } from '../core';
import { DEFAULT_PAGE_NAME } from '../model/migrate';
import { shapeSize } from '../model/shapes';
import {
  DEFAULT_EDGE_STYLE,
  type FlowEdgeStyle,
  type FlowNodeData,
  type FlowPage,
  type ShapeKind,
} from '../model/types';
import { edgePropsOf, normalizeEdgeStyle } from '../ops';

export type FlowNode = Node<FlowNodeData>;
export type FlowEdge = Edge;

/** 撤销栈上限（结构 diff 后单条记录远小于整图快照） */
export const HISTORY_LIMIT = 50;

/** 页面元数据（名称与顺序，数据另存） */
export interface PageMeta {
  id: string;
  name: string;
}

/** 默认首页 id（新建文档与清空后使用） */
export const DEFAULT_PAGE_ID = 'page-1';

/**
 * 本地化的默认页名（`tools.flowchart.defaultPageName`）。
 * i18n 尚未注册该键时回退为语言中立的 `Page N`，避免出现硬编码中文。
 */
export function defaultPageName(index: number): string {
  const key = 'tools.flowchart.defaultPageName';
  const value = i18n.t(key, { n: index });
  return typeof value === 'string' && value && value !== key ? value : `Page ${index}`;
}

/**
 * 复制页面的名称：`<原名> 副本`（i18n 缺失时回退语言中立的 `Copy`）。
 * 与 `defaultPageName` 同理，避免在 store 里硬编码文案。
 */
export function copyPageName(name: string): string {
  const key = 'tools.flowchart.pageCopySuffix';
  const suffix = i18n.t(key);
  const text = typeof suffix === 'string' && suffix && suffix !== key ? suffix : 'Copy';
  return `${name} ${text}`;
}

export function makeNode(
  kind: ShapeKind,
  position: { x: number; y: number },
  opts?: { id?: string; parentId?: string },
): FlowNode {
  const size = shapeSize(kind);
  return {
    id: opts?.id ?? createId('n'),
    type: 'shape',
    position,
    // 显式尺寸：让 React Flow 在测量前就有正确包围盒（fitView / 导出 / 自动布局均依赖）
    width: size.width,
    height: size.height,
    parentId: opts?.parentId,
    data: defaultData(kind),
  };
}

export function makeEdge(
  connection: Connection | FlowEdge,
  override?: Partial<FlowEdgeStyle>,
): FlowEdge {
  const style = normalizeEdgeStyle({ ...DEFAULT_EDGE_STYLE, ...override });
  return {
    ...connection,
    id: (connection as FlowEdge).id ?? createId('e'),
    ...edgePropsOf(style),
    data: { style },
  } as FlowEdge;
}

/**
 * 只把给定 id 标记为选中（同时清掉其它节点的 selected 标记）。
 * React Flow 以节点自身的 `selected` 为准，若只改 store 的 selectedNodes，
 * 它下一次派发 onSelectionChange 时会把选中态清空。
 * 未受影响的节点保持原引用，避免整图重渲染。
 */
export function selectOnly(nodes: readonly FlowNode[], ids: readonly string[]): FlowNode[] {
  const set = new Set(ids);
  return nodes.map((n) => {
    const shouldSelect = set.has(n.id);
    if ((n.selected === true) === shouldSelect) return n;
    return { ...n, selected: shouldSelect };
  });
}

/** 把持久化的页面记录转换为 React Flow 节点 */
export function nodesFromPage(page: FlowPage): FlowNode[] {
  return orderNodesByHierarchy(
    page.nodes.map((n) => {
      const size = shapeSize(n.data.kind);
      return {
        id: n.id,
        type: n.type ?? 'shape',
        position: { ...n.position },
        width: n.width ?? size.width,
        height: n.height ?? size.height,
        parentId: n.parentId ?? undefined,
        hidden: n.hidden === true,
        // React Flow 无 locked 字段，用 draggable/selectable 表达
        draggable: n.locked === true ? false : undefined,
        selectable: n.locked === true ? false : undefined,
        data: {
          kind: n.data.kind,
          label: n.data.label,
          style: { ...n.data.style },
          ...(n.data.collapsed ? { collapsed: true } : {}),
          ...(n.data.src ? { src: n.data.src } : {}),
          ...(n.data.iconId ? { iconId: n.data.iconId } : {}),
          ...(n.data.formula ? { formula: n.data.formula } : {}),
          ...(n.mxStyle ? { mxStyle: [...n.mxStyle] } : {}),
        },
      };
    }),
  );
}

/** 把持久化的连线记录转换为 React Flow 边（含样式） */
export function edgesFromPage(page: FlowPage): FlowEdge[] {
  return page.edges.map((e) => {
    const style = normalizeEdgeStyle(e.style);
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      label: e.label,
      data: {
        style,
        ...(e.sourceLabel ? { sourceLabel: e.sourceLabel } : {}),
        ...(e.targetLabel ? { targetLabel: e.targetLabel } : {}),
        ...(e.labelPosition ? { labelPosition: e.labelPosition } : {}),
        ...(e.waypoints && e.waypoints.length > 0
          ? { waypoints: e.waypoints.map((p) => ({ x: p.x, y: p.y })) }
          : {}),
        ...(e.mxStyle ? { mxStyle: [...e.mxStyle] } : {}),
      },
      ...edgePropsOf(style),
    };
  });
}

export { DEFAULT_PAGE_NAME };
