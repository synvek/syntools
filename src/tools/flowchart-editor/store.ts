/**
 * 流程图编辑器状态：单一真相源是 nodes / edges，其余（选中 / 历史）是会话态。
 * 所有结构性变更前先 commit() 压入历史快照，保证 undo / redo 可回放（复用 slide-editor 模式）。
 */

import { create } from 'zustand';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import {
  absolutePositionOf,
  absoluteRectOf,
  createId,
  defaultData,
  orderNodesByHierarchy,
  resolvePlacement,
  serializeDoc,
  type HelperLines,
} from './core';
import {
  DEFAULT_EDGE_STYLE,
  type FlowDoc,
  type FlowEdgeStyle,
  type FlowNodeData,
  type FlowNodePatch,
  type FlowPage,
  type ShapeKind,
  isContainerKind,
} from './model/types';
import { DEFAULT_PAGE_NAME } from './model/migrate';
import { edgePropsOf, normalizeEdgeStyle } from './ops';
import { shapeSize } from './model/shapes';
import { activePageOf, migrateDoc } from './model/migrate';
import { layoutGraph } from './layout';

const HISTORY_LIMIT = 50;

export type FlowNode = Node<FlowNodeData>;
export type FlowEdge = Edge;

interface Snapshot {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/** 版本快照：与内存态撤销栈相互独立，可命名、预览与回滚 */
export interface SnapshotRec {
  id: string;
  name: string;
  doc: FlowDoc;
  savedAt: number;
}

function makeNode(
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

function makeEdge(connection: Connection | FlowEdge, override?: Partial<FlowEdgeStyle>): FlowEdge {
  const style = normalizeEdgeStyle({ ...DEFAULT_EDGE_STYLE, ...override });
  return {
    ...connection,
    id: (connection as FlowEdge).id ?? createId('e'),
    ...edgePropsOf(style),
    data: { style },
  } as FlowEdge;
}

/** 页面元数据（名称与顺序，数据另存） */
export interface PageMeta {
  id: string;
  name: string;
}

/** 默认首页 id（新建文档与清空后使用） */
export const DEFAULT_PAGE_ID = 'page-1';

/** 把持久化的页面记录转换为 React Flow 节点 */
function nodesFromPage(page: FlowPage): FlowNode[] {
  return orderNodesByHierarchy(
    page.nodes.map((n) => {
      const size = shapeSize(n.data.kind);
      return {
        id: n.id,
        type: 'shape' as const,
        position: { ...n.position },
        width: n.width ?? size.width,
        height: n.height ?? size.height,
        parentId: n.parentId ?? undefined,
        hidden: n.hidden === true,
        // React Flow 无 locked 字段，用 draggable/selectable 表达
        draggable: n.locked === true ? false : undefined,
        selectable: n.locked === true ? false : undefined,
        data: { kind: n.data.kind, label: n.data.label, style: { ...n.data.style } },
      };
    }),
  );
}

/** 把持久化的连线记录转换为 React Flow 边（含样式） */
function edgesFromPage(page: FlowPage): FlowEdge[] {
  return page.edges.map((e) => {
    const style = normalizeEdgeStyle(e.style);
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      label: e.label,
      data: { style },
      ...edgePropsOf(style),
    };
  });
}

interface FlowState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNodes: string[];
  selectedEdges: string[];
  past: Snapshot[];
  future: Snapshot[];
  helperLines: HelperLines | null;
  /** 复制粘贴的剪贴板（会话态，不持久化） */
  clipboard: { nodes: FlowNode[]; edges: FlowEdge[] } | null;
  setClipboard: (clip: { nodes: FlowNode[]; edges: FlowEdge[] } | null) => void;
  /** 版本快照列表（最新的在前） */
  snapshots: SnapshotRec[];
  saveSnapshot: (name: string) => void;
  restoreSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;

  /** 多页：页面顺序与名称；活动页数据在 nodes/edges，其余页缓存在 pageData */
  pageOrder: PageMeta[];
  activePageId: string;
  pageData: Record<string, FlowPage>;
  addPage: (name?: string) => void;
  switchPage: (id: string) => void;
  renamePage: (id: string, name: string) => void;
  removePage: (id: string) => void;
  movePage: (id: string, dir: -1 | 1) => void;

  /** keepHistory 为 true 时保留撤销栈（用于快照回滚） */
  load: (doc: FlowDoc | null, keepHistory?: boolean) => void;
  getDoc: () => FlowDoc;

  commit: () => void;
  undo: () => void;
  redo: () => void;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  /** 重连：把已有连线的一端拖到新的节点/锚点 */
  reconnectEdge: (edgeId: string, connection: Connection) => void;
  /** 修改连线起点/终点连接的节点（属性面板下拉） */
  setEdgeEndpoint: (edgeId: string, end: 'source' | 'target', nodeId: string) => void;
  onSelectionChange: (selection: { nodes: FlowNode[]; edges: FlowEdge[] }) => void;
  /** 仅取消连线选中（保留节点选中）：用于「开始新建连线」时让出连线选择态 */
  deselectEdges: () => void;

  /** 新建连线的默认样式（工具栏可调：线型 / 线宽 / 线样式 / 起止箭头） */
  defaultEdge: FlowEdgeStyle;
  setDefaultEdge: (patch: Partial<FlowEdgeStyle>) => void;
  /** 在指定绝对坐标生成新节点（默认同类型，可指定 kind）并与源节点连线；返回新节点 id */
  spawnConnectedNode: (
    sourceId: string,
    position: { x: number; y: number },
    kind?: ShapeKind,
  ) => string | undefined;
  /** 改变节点图形类型（保留位置与连线，尺寸/默认样式随类型更新） */
  changeNodeKind: (id: string, kind: ShapeKind) => void;

  addNode: (kind: ShapeKind, position: { x: number; y: number }) => void;
  reparentNode: (id: string) => void;
  setNodeLabel: (id: string, label: string, history?: boolean) => void;
  patchSelected: (patch: FlowNodePatch, history?: boolean) => void;
  patchEdgeLabel: (id: string, label: string) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  applyAutoLayout: (direction?: 'TB' | 'LR') => void;
  clear: () => void;
  setHelperLines: (lines: HelperLines | null) => void;
}

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodes: [],
  selectedEdges: [],
  past: [],
  future: [],
  helperLines: null,
  defaultEdge: { ...DEFAULT_EDGE_STYLE },
  clipboard: null,
  snapshots: [],
  pageOrder: [{ id: DEFAULT_PAGE_ID, name: DEFAULT_PAGE_NAME }],
  activePageId: DEFAULT_PAGE_ID,
  pageData: {},

  setClipboard: (clip) => set({ clipboard: clip }),

  saveSnapshot: (name) => {
    const doc = get().getDoc();
    const rec: SnapshotRec = { id: createId('snap'), name, doc, savedAt: Date.now() };
    set((s) => ({ snapshots: [rec, ...s.snapshots].slice(0, 20) }));
  },

  restoreSnapshot: (id) => {
    const snap = get().snapshots.find((s) => s.id === id);
    if (!snap) return;
    // 先压入当前状态，回滚后仍可撤销；保留历史栈不清空
    get().commit();
    get().load(snap.doc, true);
  },

  deleteSnapshot: (id) => set((s) => ({ snapshots: s.snapshots.filter((n) => n.id !== id) })),

  load: (doc, keepHistory = false) => {
    const empty = {
      nodes: [],
      edges: [],
      past: [],
      future: [],
      selectedNodes: [],
      selectedEdges: [],
    };
    const defaultPages = {
      pageOrder: [{ id: DEFAULT_PAGE_ID, name: DEFAULT_PAGE_NAME }],
      activePageId: DEFAULT_PAGE_ID,
      pageData: {} as Record<string, FlowPage>,
    };
    if (!doc) {
      set({ ...empty, ...defaultPages });
      return;
    }
    // 迁移到 v2 后按页恢复：旧版 v1 草稿也能正常读取，多页结构一并保留
    const normalized = migrateDoc(doc);
    const page = activePageOf(normalized);
    if (!normalized || !page) {
      set({ ...empty, ...defaultPages });
      return;
    }
    const pageData: Record<string, FlowPage> = {};
    for (const p of normalized.pages) {
      if (p.id !== page.id) pageData[p.id] = p;
    }
    set((s) => ({
      nodes: nodesFromPage(page),
      edges: edgesFromPage(page),
      pageOrder: normalized.pages.map((p) => ({ id: p.id, name: p.name })),
      activePageId: page.id,
      pageData,
      past: keepHistory ? s.past : [],
      future: keepHistory ? s.future : [],
      selectedNodes: [],
      selectedEdges: [],
    }));
  },

  getDoc: () => {
    const { nodes, edges, pageOrder, activePageId, pageData } = get();
    // 活动页即时序列化（拿到最新的 FlowNodeRec / FlowEdgeRec）
    const current = serializeDoc(
      nodes.map((n) => ({
        id: n.id,
        position: n.position,
        parentId: n.parentId,
        data: n.data,
        width: n.width,
        height: n.height,
        hidden: n.hidden === true,
        locked: n.draggable === false,
      })),
      edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: typeof e.label === 'string' ? e.label : undefined,
        style: (e.data as { style?: FlowEdgeStyle } | undefined)?.style,
      })),
    );
    const currentPage = current.pages[0];
    const pages: FlowPage[] = pageOrder.map((meta) => {
      if (meta.id === activePageId) {
        return { id: meta.id, name: meta.name, nodes: currentPage.nodes, edges: currentPage.edges };
      }
      const cached = pageData[meta.id];
      return {
        id: meta.id,
        name: meta.name,
        nodes: cached?.nodes ?? [],
        edges: cached?.edges ?? [],
      };
    });
    return { version: 2, pages, activePageId };
  },

  commit: () =>
    set((s) => ({
      past: [...s.past, { nodes: s.nodes, edges: s.edges }].slice(-HISTORY_LIMIT),
      future: [],
    })),

  undo: () =>
    set((s) => {
      const previous = s.past[s.past.length - 1];
      if (!previous) return s;
      return {
        past: s.past.slice(0, -1),
        future: [{ nodes: s.nodes, edges: s.edges }, ...s.future].slice(0, HISTORY_LIMIT),
        nodes: previous.nodes,
        edges: previous.edges,
        selectedNodes: [],
        selectedEdges: [],
      };
    }),

  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return s;
      return {
        past: [...s.past, { nodes: s.nodes, edges: s.edges }].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
        nodes: next.nodes,
        edges: next.edges,
        selectedNodes: [],
        selectedEdges: [],
      };
    }),

  onNodesChange: (changes) => {
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) as FlowNode[] }));
    const selected = get()
      .nodes.filter((n) => n.selected)
      .map((n) => n.id);
    if (
      selected.length !== get().selectedNodes.length ||
      selected.some((id) => !get().selectedNodes.includes(id))
    ) {
      set({ selectedNodes: selected });
    }
  },

  onEdgesChange: (changes) => set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

  onConnect: (connection) => {
    get().commit();
    const edge = makeEdge(connection, get().defaultEdge);
    set((s) => ({ edges: addEdge(edge, s.edges) }));
  },

  reconnectEdge: (edgeId, connection) => {
    const edge = get().edges.find((e) => e.id === edgeId);
    if (!edge) return;
    const nextSource = connection.source ?? edge.source;
    const nextTarget = connection.target ?? edge.target;
    const nextSourceHandle = connection.sourceHandle ?? null;
    const nextTargetHandle = connection.targetHandle ?? null;
    // 无变化则不写入历史
    if (
      edge.source === nextSource &&
      edge.target === nextTarget &&
      (edge.sourceHandle ?? null) === nextSourceHandle &&
      (edge.targetHandle ?? null) === nextTargetHandle
    ) {
      return;
    }
    get().commit();
    set((s) => ({
      edges: s.edges.map((e) =>
        e.id === edgeId
          ? {
              ...e,
              source: nextSource,
              target: nextTarget,
              sourceHandle: nextSourceHandle,
              targetHandle: nextTargetHandle,
            }
          : e,
      ),
    }));
  },

  setEdgeEndpoint: (edgeId, end, nodeId) => {
    const state = get();
    const edge = state.edges.find((e) => e.id === edgeId);
    if (!edge) return;
    const otherId = end === 'source' ? edge.target : edge.source;
    if (nodeId === otherId) return; // 不允许自连
    if ((end === 'source' ? edge.source : edge.target) === nodeId) return;
    const nodes = state.nodes;
    const node = nodes.find((n) => n.id === nodeId);
    const other = nodes.find((n) => n.id === otherId);
    if (!node || !other) return;
    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    const a = absoluteRectOf(node, byId);
    const b = absoluteRectOf(other, byId);
    const dx = b.x + b.width / 2 - (a.x + a.width / 2);
    const dy = b.y + b.height / 2 - (a.y + a.height / 2);
    // 新节点朝向对端的一侧锚点
    const handle = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'r' : 'l') : dy >= 0 ? 'b' : 't';
    get().commit();
    set((s) => ({
      edges: s.edges.map((e) => {
        if (e.id !== edgeId) return e;
        return end === 'source'
          ? { ...e, source: nodeId, sourceHandle: handle }
          : { ...e, target: nodeId, targetHandle: handle };
      }),
    }));
  },

  setDefaultEdge: (patch) => set((s) => ({ defaultEdge: { ...s.defaultEdge, ...patch } })),

  spawnConnectedNode: (sourceId, position, kindOverride) => {
    const state = get();
    const src = state.nodes.find((n) => n.id === sourceId);
    if (!src || isContainerKind(src.data.kind)) return;
    const kind = kindOverride ?? src.data.kind;
    const byId = new Map(state.nodes.map((n) => [n.id, n] as const));
    const size = shapeSize(kind);
    const rect = { x: position.x, y: position.y, width: size.width, height: size.height };
    const lanes = state.nodes
      .filter((n) => isContainerKind(n.data.kind))
      .map((n) => ({ id: n.id, rect: absoluteRectOf(n, byId) }));
    const placement = resolvePlacement(rect, lanes);
    const newId = createId('n');
    const node: FlowNode = {
      id: newId,
      type: 'shape',
      position: placement.position,
      width: size.width,
      height: size.height,
      parentId: placement.parentId,
      data: defaultData(kind),
    };
    // 依据源节点与新节点中心的相对方位选择最合适的锚点
    const srcAbs = absolutePositionOf(src, byId);
    const dx = position.x - srcAbs.x;
    const dy = position.y - srcAbs.y;
    let sh = 'b';
    let th = 't';
    if (Math.abs(dx) >= Math.abs(dy)) {
      sh = dx >= 0 ? 'r' : 'l';
      th = dx >= 0 ? 'l' : 'r';
    } else {
      sh = dy >= 0 ? 'b' : 't';
      th = dy >= 0 ? 't' : 'b';
    }
    get().commit();
    const edge = makeEdge(
      { source: sourceId, sourceHandle: sh, target: newId, targetHandle: th },
      get().defaultEdge,
    );
    set((s) => ({
      nodes: orderNodesByHierarchy([...s.nodes, node]),
      edges: addEdge(edge, s.edges),
      selectedNodes: [newId],
    }));
    return newId;
  },

  changeNodeKind: (id, kind) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node || node.data.kind === kind) return;
    const size = shapeSize(kind);
    get().commit();
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              width: size.width,
              height: size.height,
              // 换形状保留已有文本
              data: defaultData(kind, n.data.label),
            }
          : n,
      ),
    }));
  },

  onSelectionChange: (selection) =>
    set({
      selectedNodes: selection.nodes.map((n) => n.id),
      selectedEdges: selection.edges.map((e) => e.id),
    }),

  deselectEdges: () => {
    const { edges, selectedEdges } = get();
    if (selectedEdges.length === 0) return;
    const ids = new Set(selectedEdges);
    set({
      edges: edges.map((e) => (ids.has(e.id) ? { ...e, selected: false } : e)),
      selectedEdges: [],
    });
  },

  addNode: (kind, position) => {
    get().commit();
    const size = shapeSize(kind);
    let parentId: string | undefined;
    let finalPosition = position;
    if (!isContainerKind(kind)) {
      const current = get().nodes;
      const byId = new Map(current.map((n) => [n.id, n] as const));
      const lanes = current
        .filter((n) => isContainerKind(n.data.kind))
        .map((n) => ({ id: n.id, rect: absoluteRectOf(n, byId) }));
      const placement = resolvePlacement({ x: position.x, y: position.y, ...size }, lanes);
      parentId = placement.parentId;
      finalPosition = placement.position;
    }
    const node = makeNode(kind, finalPosition, { parentId });
    set((s) => ({
      nodes: orderNodesByHierarchy([...s.nodes, node]),
      selectedNodes: [node.id],
    }));
  },

  reparentNode: (id) => {
    const current = get().nodes;
    const node = current.find((n) => n.id === id);
    if (!node || isContainerKind(node.data.kind)) return;
    const byId = new Map(current.map((n) => [n.id, n] as const));
    const rect = absoluteRectOf(node, byId);
    const lanes = current
      .filter((n) => isContainerKind(n.data.kind) && n.id !== id)
      .map((n) => ({ id: n.id, rect: absoluteRectOf(n, byId) }));
    const placement = resolvePlacement(rect, lanes);
    const nextParentId = placement.parentId;
    const sameParent = (node.parentId ?? undefined) === nextParentId;
    const samePos =
      node.position.x === placement.position.x && node.position.y === placement.position.y;
    if (sameParent && samePos) return;
    get().commit();
    set((s) => ({
      nodes: orderNodesByHierarchy(
        s.nodes.map((n) =>
          n.id === id ? { ...n, parentId: nextParentId, position: placement.position } : n,
        ),
      ),
    }));
  },

  setNodeLabel: (id, label, history = false) => {
    if (history) get().commit();
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)),
    }));
  },

  patchSelected: (patch, history = true) => {
    if (history) get().commit();
    set((s) => ({
      nodes: s.nodes.map((n) =>
        s.selectedNodes.includes(n.id)
          ? { ...n, data: { ...n.data, ...patch, style: { ...n.data.style, ...patch.style } } }
          : n,
      ),
    }));
  },

  patchEdgeLabel: (id, label) => {
    get().commit();
    set((s) => ({ edges: s.edges.map((e) => (e.id === id ? { ...e, label } : e)) }));
  },

  removeSelected: () => {
    const { selectedNodes, selectedEdges } = get();
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
    get().commit();
    const nodeSet = new Set(selectedNodes);
    // 删除泳道时，其内部子节点一并删除，避免出现孤儿
    for (const n of get().nodes) {
      if (n.parentId && nodeSet.has(n.parentId)) nodeSet.add(n.id);
    }
    const edgeSet = new Set(selectedEdges);
    set((s) => ({
      nodes: s.nodes.filter((n) => !nodeSet.has(n.id)),
      edges: s.edges.filter(
        (e) => !edgeSet.has(e.id) && !nodeSet.has(e.source) && !nodeSet.has(e.target),
      ),
      selectedNodes: [],
      selectedEdges: [],
    }));
  },

  duplicateSelected: () => {
    const { selectedNodes } = get();
    if (selectedNodes.length === 0) return;
    get().commit();
    const copies: FlowNode[] = get()
      .nodes.filter((n) => selectedNodes.includes(n.id))
      .map((n) => ({
        ...n,
        id: createId('n'),
        position: { x: n.position.x + 32, y: n.position.y + 32 },
        selected: false,
        data: { ...n.data, style: { ...n.data.style } },
      }));
    set((s) => ({
      nodes: orderNodesByHierarchy([...s.nodes, ...copies]),
      selectedNodes: copies.map((c) => c.id),
    }));
  },

  applyAutoLayout: (direction = 'TB') => {
    get().commit();
    set((s) => {
      // 自动布局会整体重排：先把子节点提升为绝对坐标并解除泳道归属
      const byId = new Map(s.nodes.map((n) => [n.id, n] as const));
      const detached = s.nodes.map((n) => {
        if (!n.parentId) return { ...n, parentId: undefined };
        return { ...n, position: absolutePositionOf(n, byId), parentId: undefined };
      });
      return { nodes: layoutGraph(detached, s.edges, direction) };
    });
  },

  clear: () => {
    get().commit();
    set({ nodes: [], edges: [], selectedNodes: [], selectedEdges: [] });
  },

  addPage: (name) => {
    const state = get();
    const doc = state.getDoc();
    const cur = doc.pages.find((p) => p.id === state.activePageId);
    const id = createId('page');
    set({
      pageOrder: [
        ...state.pageOrder,
        { id, name: name?.trim() || `页面 ${state.pageOrder.length + 1}` },
      ],
      activePageId: id,
      // 先把当前页内容缓存起来，再切换到空白新页
      pageData: { ...state.pageData, ...(cur ? { [state.activePageId]: cur } : {}) },
      nodes: [],
      edges: [],
      selectedNodes: [],
      selectedEdges: [],
    });
  },

  switchPage: (id) => {
    const state = get();
    if (id === state.activePageId) return;
    const doc = state.getDoc();
    const cur = doc.pages.find((p) => p.id === state.activePageId);
    const target = doc.pages.find((p) => p.id === id);
    if (!target) return;
    const pageData = { ...state.pageData };
    if (cur) pageData[state.activePageId] = cur;
    delete pageData[id];
    set({
      nodes: nodesFromPage(target),
      edges: edgesFromPage(target),
      activePageId: id,
      pageData,
      selectedNodes: [],
      selectedEdges: [],
    });
  },

  renamePage: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((s) => ({
      pageOrder: s.pageOrder.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
    }));
  },

  removePage: (id) => {
    const state = get();
    if (state.pageOrder.length <= 1) return;
    const idx = state.pageOrder.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const pageOrder = state.pageOrder.filter((p) => p.id !== id);
    const pageData = { ...state.pageData };
    delete pageData[id];
    if (id !== state.activePageId) {
      set({ pageOrder, pageData });
      return;
    }
    // 删除当前页：切到相邻页并载入其内容
    const next = pageOrder[Math.min(idx, pageOrder.length - 1)];
    const doc = state.getDoc();
    const target =
      doc.pages.find((p) => p.id === next.id) ?? ({ ...next, nodes: [], edges: [] } as FlowPage);
    set({
      pageOrder,
      pageData,
      activePageId: next.id,
      nodes: nodesFromPage(target),
      edges: edgesFromPage(target),
      selectedNodes: [],
      selectedEdges: [],
    });
  },

  movePage: (id, dir) => {
    set((s) => {
      const idx = s.pageOrder.findIndex((p) => p.id === id);
      const nextIdx = idx + dir;
      if (idx < 0 || nextIdx < 0 || nextIdx >= s.pageOrder.length) return s;
      const pageOrder = [...s.pageOrder];
      [pageOrder[idx], pageOrder[nextIdx]] = [pageOrder[nextIdx], pageOrder[idx]];
      return { pageOrder };
    });
  },

  setHelperLines: (lines) => set({ helperLines: lines }),
}));
