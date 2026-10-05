/**
 * 流程图编辑器状态：单一真相源是 nodes / edges，其余（选中 / 历史）是会话态。
 *
 * 结构：
 * - `store/helpers.ts`  共享纯工具（节点/边构造、页面互转、选择归一化）
 * - `store/history.ts`  撤销/重做（结构 diff，见该文件说明）
 * - 本文件：文档编辑（doc/UI）与多页、快照的组合根；对外 API 与调用点保持不变。
 */

import { create } from 'zustand';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import {
  absolutePositionOf,
  absoluteRectOf,
  anchorOf,
  createId,
  defaultData,
  orderNodesByHierarchy,
  resolvePlacement,
  serializeDoc,
  stubPoint,
  type HelperLines,
} from './core';
import {
  DEFAULT_EDGE_STYLE,
  type FlowDoc,
  type FlowEdgeData,
  type FlowEdgeStyle,
  type FlowNodeData,
  type FlowNodePatch,
  type FlowNodeStyle,
  type FlowNodeType,
  type FlowPage,
  type ShapeKind,
  type Waypoint,
  isContainerKind,
} from './model/types';
import { DEFAULT_PAGE_NAME } from './model/migrate';
import { dropCollinear, routeOrthogonal } from './ops';
import { shapeSize } from './model/shapes';
import { activePageOf, migrateDoc } from './model/migrate';
import {
  layoutGraph,
  type LayoutDensity,
  type LayoutDirection,
  type LayoutOptions,
} from './layout';
import {
  DEFAULT_PAGE_ID,
  defaultPageName,
  edgesFromPage,
  makeEdge,
  makeNode,
  nodesFromPage,
  selectOnly,
  type FlowEdge,
  type FlowNode,
  type PageMeta,
} from './store/helpers';
import { createHistorySlice, type HistoryDiff } from './store/history';

/** 版本快照：与内存态撤销栈相互独立，可命名、预览与回滚 */
export interface SnapshotRec {
  id: string;
  name: string;
  doc: FlowDoc;
  savedAt: number;
}

interface FlowState {
  /** 文档标题：导出文件名来源 */
  docName: string;
  setDocName: (name: string) => void;
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNodes: string[];
  selectedEdges: string[];
  /** 撤销栈：每条记录只包含本次变更涉及的节点/边（结构 diff） */
  past: HistoryDiff[];
  future: HistoryDiff[];
  helperLines: HelperLines | null;
  /** 复制粘贴的剪贴板（会话态，不持久化） */
  clipboard: { nodes: FlowNode[]; edges: FlowEdge[] } | null;
  setClipboard: (clip: { nodes: FlowNode[]; edges: FlowEdge[] } | null) => void;
  /** 版本快照列表（最新的在前） */
  snapshots: SnapshotRec[];
  saveSnapshot: (name: string) => void;
  restoreSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;

  /** 画布网格吸附：开关与网格尺寸（会话态，不落文档） */
  gridEnabled: boolean;
  gridSize: number;
  setGridEnabled: (v: boolean) => void;
  setGridSize: (v: number) => void;
  /** 自动布局参数：方向与间距预设 */
  layoutDirection: LayoutDirection;
  layoutDensity: LayoutDensity;
  setLayoutDirection: (v: LayoutDirection) => void;
  setLayoutDensity: (v: LayoutDensity) => void;
  /** 对齐辅助线吸附阈值（px） */
  alignTolerance: number;
  setAlignTolerance: (v: number) => void;
  /** 格式刷：已复制的节点样式（会话态，不持久化） */
  styleBrush: FlowNodeStyle | null;
  setStyleBrush: (style: FlowNodeStyle | null) => void;
  /** 全选当前页的节点与连线（锁定节点除外） */
  selectAll: () => void;
  /** 按方向键微移选中节点（不写历史，由调用方合并为一次撤销） */
  nudgeSelected: (dx: number, dy: number) => void;

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
  /** 载入文档后重建历史基线（keep 为真时保留撤销栈） */
  resetHistory: (keep?: boolean) => void;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  /** 重连：把已有连线的一端拖到新的节点/锚点 */
  reconnectEdge: (edgeId: string, connection: Connection) => void;
  /** 修改连线起点/终点连接的节点（属性面板下拉） */
  setEdgeEndpoint: (edgeId: string, end: 'source' | 'target', nodeId: string) => void;
  /** 写入/清除连线折点（传入空数组等于清除） */
  setEdgeWaypoints: (edgeId: string, waypoints: Waypoint[] | undefined, history?: boolean) => void;
  /** 对选中连线执行正交自动布线（避开其它节点包围盒） */
  autoRouteSelectedEdges: () => void;
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
  /** 插入非图形节点（图片 / 图标 / 公式），返回新节点 id */
  addTypedNode: (
    type: FlowNodeType,
    data: FlowNodeData,
    size: { width: number; height: number },
    position: { x: number; y: number },
  ) => string;
  /** 改写公式节点的 LaTeX 源码 */
  setNodeFormula: (id: string, formula: string, history?: boolean) => void;
  reparentNode: (id: string) => void;
  /** 拖拽结束后的归属判定（图层面板：拖入容器 / 拖回画布顶层） */
  reparentNodeTo: (id: string, parentId?: string) => void;
  /** 图层排序：把节点移动到目标节点之前（保持父在子前的层级不变量） */
  reorderNode: (id: string, targetId: string) => void;
  setNodeLabel: (id: string, label: string, history?: boolean) => void;
  patchSelected: (patch: FlowNodePatch, history?: boolean) => void;
  patchEdgeLabel: (id: string, label: string, history?: boolean) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  applyAutoLayout: (options?: LayoutOptions) => void;
  clear: () => void;
  setHelperLines: (lines: HelperLines | null) => void;
}

export const useFlowStore = create<FlowState>((set, get) => ({
  // 撤销/重做：结构 diff 历史（见 store/history.ts）
  ...createHistorySlice<FlowState>(set, get),
  docName: '',
  setDocName: (name) => set({ docName: name }),
  nodes: [],
  edges: [],
  selectedNodes: [],
  selectedEdges: [],
  helperLines: null,
  defaultEdge: { ...DEFAULT_EDGE_STYLE },
  clipboard: null,
  snapshots: [],
  gridEnabled: true,
  gridSize: 10,
  layoutDirection: 'TB',
  layoutDensity: 'normal',
  alignTolerance: 5,
  styleBrush: null,
  pageOrder: [{ id: DEFAULT_PAGE_ID, name: DEFAULT_PAGE_NAME }],
  activePageId: DEFAULT_PAGE_ID,
  pageData: {},

  setClipboard: (clip) => set({ clipboard: clip }),

  setGridEnabled: (v) => set({ gridEnabled: v }),
  setGridSize: (v) => set({ gridSize: v }),
  setLayoutDirection: (v) => set({ layoutDirection: v }),
  setLayoutDensity: (v) => set({ layoutDensity: v }),
  setAlignTolerance: (v) => set({ alignTolerance: v }),
  setStyleBrush: (style) => set({ styleBrush: style }),

  selectAll: () =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.selectable === false ? n : { ...n, selected: true })),
      edges: s.edges.map((e) => ({ ...e, selected: true })),
      selectedNodes: s.nodes.filter((n) => n.selectable !== false).map((n) => n.id),
      selectedEdges: s.edges.map((e) => e.id),
    })),

  nudgeSelected: (dx, dy) => {
    const ids = new Set(get().selectedNodes);
    if (ids.size === 0) return;
    set((s) => ({
      nodes: s.nodes.map((n) =>
        ids.has(n.id) && n.draggable !== false
          ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
          : n,
      ),
    }));
  },

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
      selectedNodes: [],
      selectedEdges: [],
    };
    const defaultPages = {
      pageOrder: [{ id: DEFAULT_PAGE_ID, name: defaultPageName(1) }],
      activePageId: DEFAULT_PAGE_ID,
      pageData: {} as Record<string, FlowPage>,
    };
    if (!doc) {
      set({ ...empty, ...defaultPages, docName: '' });
      get().resetHistory(keepHistory);
      return;
    }
    // 迁移到 v2 后按页恢复：旧版 v1 草稿也能正常读取，多页结构一并保留
    const normalized = migrateDoc(doc);
    const page = activePageOf(normalized);
    if (!normalized || !page) {
      set({ ...empty, ...defaultPages, docName: '' });
      get().resetHistory(keepHistory);
      return;
    }
    const pageData: Record<string, FlowPage> = {};
    for (const p of normalized.pages) {
      if (p.id !== page.id) pageData[p.id] = p;
    }
    set({
      nodes: nodesFromPage(page),
      edges: edgesFromPage(page),
      docName: normalized.name ?? '',
      pageOrder: normalized.pages.map((p) => ({ id: p.id, name: p.name })),
      activePageId: page.id,
      pageData,
      selectedNodes: [],
      selectedEdges: [],
    });
    // 载入即新的历史基线：未显式保留时清空撤销栈
    get().resetHistory(keepHistory);
  },

  getDoc: () => {
    const { nodes, edges, pageOrder, activePageId, pageData, docName } = get();
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
        type: n.type as FlowNodeType | undefined,
        mxStyle: n.data.mxStyle,
      })),
      edges.map((e) => {
        const data = e.data as FlowEdgeData | undefined;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          label: typeof e.label === 'string' ? e.label : undefined,
          style: data?.style,
          waypoints: data?.waypoints,
          mxStyle: data?.mxStyle,
        };
      }),
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
    return {
      version: 2,
      ...(docName ? { name: docName } : {}),
      pages,
      activePageId,
    };
  },

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

  setEdgeWaypoints: (edgeId, waypoints, history = true) => {
    const next =
      waypoints && waypoints.length > 0
        ? waypoints.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))
        : undefined;
    if (history) get().commit();
    set((s) => ({
      edges: s.edges.map((e) => {
        if (e.id !== edgeId) return e;
        const data: FlowEdgeData = { ...(e.data as FlowEdgeData | undefined) };
        if (next) data.waypoints = next;
        else delete data.waypoints;
        return { ...e, data };
      }),
    }));
  },

  autoRouteSelectedEdges: () => {
    const { edges, selectedEdges, nodes } = get();
    if (selectedEdges.length === 0) return;
    const ids = new Set(selectedEdges);
    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    const obstacles = nodes
      .filter((n) => n.hidden !== true)
      .map((n) => ({ id: n.id, rect: absoluteRectOf(n, byId) }));

    let changed = false;
    const nextEdges = edges.map((e) => {
      if (!ids.has(e.id)) return e;
      const source = byId.get(e.source);
      const target = byId.get(e.target);
      if (!source || !target) return e;
      const from = anchorOf(source, byId, e.sourceHandle, target);
      const to = anchorOf(target, byId, e.targetHandle, source);
      const fromStub = stubPoint(from.point, from.side);
      const toStub = stubPoint(to.point, to.side);
      const boxes = obstacles
        .filter((o) => o.id !== e.source && o.id !== e.target)
        .map((o) => o.rect);
      const middle = routeOrthogonal(fromStub, toStub, boxes);
      const waypoints = dropCollinear([fromStub, ...middle, toStub]);
      const data: FlowEdgeData = { ...(e.data as FlowEdgeData | undefined), waypoints };
      changed = true;
      return { ...e, data };
    });
    if (!changed) return;
    get().commit();
    set({ edges: nextEdges });
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
      nodes: selectOnly(orderNodesByHierarchy([...s.nodes, node]), [newId]),
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
      nodes: selectOnly(orderNodesByHierarchy([...s.nodes, node]), [node.id]),
      selectedNodes: [node.id],
    }));
  },

  addTypedNode: (type, data, size, position) => {
    get().commit();
    const current = get().nodes;
    const byId = new Map(current.map((n) => [n.id, n] as const));
    const lanes = current
      .filter((n) => isContainerKind(n.data.kind))
      .map((n) => ({ id: n.id, rect: absoluteRectOf(n, byId) }));
    const placement = resolvePlacement({ x: position.x, y: position.y, ...size }, lanes);
    const node: FlowNode = {
      id: createId('n'),
      type,
      position: placement.position,
      width: size.width,
      height: size.height,
      parentId: placement.parentId,
      data,
    };
    set((s) => ({
      nodes: selectOnly(orderNodesByHierarchy([...s.nodes, node]), [node.id]),
      selectedNodes: [node.id],
    }));
    return node.id;
  },

  setNodeFormula: (id, formula, history = true) => {
    if (history) get().commit();
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, formula } } : n)),
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

  reparentNodeTo: (id, parentId) => {
    const { nodes } = get();
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    // 容器之间不支持嵌套（与画布拖拽保持一致）
    if (parentId && isContainerKind(node.data.kind)) return;
    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    const abs = absolutePositionOf(node, byId);
    let next: { parentId: string | undefined; position: { x: number; y: number } };
    if (parentId) {
      const parent = byId.get(parentId);
      if (!parent || !isContainerKind(parent.data.kind)) return;
      const parentAbs = absolutePositionOf(parent, byId);
      const size = {
        width: parent.width ?? shapeSize(parent.data.kind).width,
        height: parent.height ?? shapeSize(parent.data.kind).height,
      };
      // 相对坐标保持视觉位置，并夹进容器内部（避免子节点落在容器之外）
      const rel = { x: Math.round(abs.x - parentAbs.x), y: Math.round(abs.y - parentAbs.y) };
      next = {
        parentId,
        position: {
          x: Math.min(Math.max(rel.x, 12), Math.max(12, size.width - 60)),
          y: Math.min(Math.max(rel.y, 12), Math.max(12, size.height - 50)),
        },
      };
    } else {
      next = { parentId: undefined, position: { x: Math.round(abs.x), y: Math.round(abs.y) } };
    }
    const sameParent = (node.parentId ?? undefined) === next.parentId;
    if (sameParent && node.position.x === next.position.x && node.position.y === next.position.y) {
      return;
    }
    get().commit();
    set((s) => ({
      nodes: orderNodesByHierarchy(s.nodes.map((n) => (n.id === id ? { ...n, ...next } : n))),
    }));
  },

  reorderNode: (id, targetId) => {
    if (id === targetId) return;
    const { nodes } = get();
    const from = nodes.findIndex((n) => n.id === id);
    const to = nodes.findIndex((n) => n.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...nodes];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    get().commit();
    set({ nodes: orderNodesByHierarchy(next) });
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

  patchEdgeLabel: (id, label, history = true) => {
    if (history) get().commit();
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
    set((s) => {
      const ids = copies.map((c) => c.id);
      return {
        nodes: selectOnly(orderNodesByHierarchy([...s.nodes, ...copies]), ids),
        selectedNodes: ids,
      };
    });
  },

  applyAutoLayout: (options = {}) => {
    get().commit();
    // 两段式布局默认保留泳道/编组层级，容器位置与内部相对坐标一起重排
    set((s) => ({ nodes: layoutGraph(s.nodes, s.edges, options) }));
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
        { id, name: name?.trim() || defaultPageName(state.pageOrder.length + 1) },
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

/* ------------------------------ 兼容导出 ------------------------------ */
// 实现已下沉到 store/helpers.ts 与 store/history.ts；对外 API 保持不变，
// 调用点（UI / flowOps / 单测）无需改动。

export {
  DEFAULT_PAGE_ID,
  DEFAULT_PAGE_NAME,
  defaultPageName,
  edgesFromPage,
  makeEdge,
  makeNode,
  nodesFromPage,
  selectOnly,
  type FlowEdge,
  type FlowNode,
  type PageMeta,
} from './store/helpers';
export { applyListDiff, diffList, type HistoryDiff, type ListEntry } from './store/history';
