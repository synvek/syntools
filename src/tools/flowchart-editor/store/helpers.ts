/**
 * Shared helpers inside the store: node/edge builders, page records ↔ React Flow nodes, selection normalization.
 * Moved down out of `store.ts`, kept as pure functions for easy unit-testing and reuse.
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

/** Undo stack limit (after structural diffing, one entry is far smaller than a whole-graph snapshot) */
export const HISTORY_LIMIT = 50;

/** Page metadata (name and order; data is stored separately) */
export interface PageMeta {
  id: string;
  name: string;
}

/** Default first-page id (used for new documents and after clearing) */
export const DEFAULT_PAGE_ID = 'page-1';

/**
 * Localized default page name (`tools.flowchart.defaultPageName`).
 * Falls back to the language-neutral `Page N` while i18n has not registered that key, avoiding hard-coded Chinese.
 */
export function defaultPageName(index: number): string {
  const key = 'tools.flowchart.defaultPageName';
  const value = i18n.t(key, { n: index });
  return typeof value === 'string' && value && value !== key ? value : `Page ${index}`;
}

/**
 * Name of a duplicated page: `<original name> copy` (falls back to the language-neutral `Copy` when i18n is missing).
 * Same reasoning as `defaultPageName`: no copy is hard-coded in the store.
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
    // Explicit size so React Flow has correct bounds before measuring (fitView / export / auto-layout all depend on it)
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
 * Mark only the given ids as selected (also clearing the selected flag on other nodes).
 * React Flow trusts the node's own `selected` flag; changing only the store's selectedNodes
 * would be cleared the next time it dispatches onSelectionChange.
 * Unaffected nodes keep their references, avoiding a full re-render.
 */
export function selectOnly(nodes: readonly FlowNode[], ids: readonly string[]): FlowNode[] {
  const set = new Set(ids);
  return nodes.map((n) => {
    const shouldSelect = set.has(n.id);
    if ((n.selected === true) === shouldSelect) return n;
    return { ...n, selected: shouldSelect };
  });
}

/** Convert persisted page records into React Flow nodes */
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
        // React Flow has no locked field, so draggable/selectable express it
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
          ...(n.data.table ? { table: n.data.table } : {}),
          ...(n.mxStyle ? { mxStyle: [...n.mxStyle] } : {}),
        },
      };
    }),
  );
}

/** Convert persisted edge records into React Flow edges (styles included) */
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
        ...(e.routing ? { routing: e.routing } : {}),
        ...(e.avoidObstacles ? { avoidObstacles: true } : {}),
        ...(e.mxStyle ? { mxStyle: [...e.mxStyle] } : {}),
      },
      ...edgePropsOf(style),
    };
  });
}

export { DEFAULT_PAGE_NAME };
