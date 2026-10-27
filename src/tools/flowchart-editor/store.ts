/**
 * Flowchart editor state: nodes / edges are the single source of truth; everything else (selection / history) is session state.
 *
 * Layout:
 * - `store/helpers.ts`  shared pure utilities (node/edge builders, page conversion, selection normalization)
 * - `store/history.ts`  undo/redo (structural diff, see the notes in that file)
 * - this file: composition root for document editing (doc/UI) plus multi-page and snapshots; the public API and call sites stay unchanged.
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
  normalizeRotation,
  orderNodesByHierarchy,
  resolvePlacement,
  scaleChildren,
  serializeDoc,
  stubPoint,
  type HelperLines,
  type ScaledChild,
} from './core';
import {
  DEFAULT_EDGE_STYLE,
  MAX_PASTE_NODES,
  MIN_PAGE_SIZE,
  type CanvasGuide,
  type EdgeLabelPosition,
  type FlowDoc,
  type GridStyle,
  type ShapeSize,
  type WheelMode,
  type FlowEdgeData,
  type FlowEdgeRec,
  type FlowEdgeStyle,
  type FlowNodeData,
  type FlowNodePatch,
  type FlowNodeRec,
  type FlowNodeStyle,
  type FlowNodeType,
  type FlowPage,
  type GroupScaleItem,
  type NodeGeometryPatch,
  type NodeTransformPatch,
  type ShapeKind,
  type TableData,
  type Waypoint,
  isContainerKind,
  minNodeSize,
} from './model/types';
import { DEFAULT_PAGE_NAME } from './model/migrate';
import { routeEdges } from './model/routing';
import { normalizeTable, setCellText } from './model/table';
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
  copyPageName,
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

/** Version snapshot: independent of the in-memory undo stack; can be named, previewed and restored */
export interface SnapshotRec {
  id: string;
  name: string;
  doc: FlowDoc;
  savedAt: number;
}

interface FlowState {
  /** Document title: source of the export file name */
  docName: string;
  setDocName: (name: string) => void;
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNodes: string[];
  selectedEdges: string[];
  /** Undo stack: each entry holds only the nodes/edges touched by that change (structural diff) */
  past: HistoryDiff[];
  future: HistoryDiff[];
  helperLines: HelperLines | null;
  /** Copy/paste clipboard (session state, not persisted) */
  clipboard: { nodes: FlowNode[]; edges: FlowEdge[] } | null;
  setClipboard: (clip: { nodes: FlowNode[]; edges: FlowEdge[] } | null) => void;
  /** Version snapshot list (newest first) */
  snapshots: SnapshotRec[];
  saveSnapshot: (name: string) => void;
  restoreSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;

  /** Canvas grid snapping: toggle and grid size (session state, not part of the document) */
  gridEnabled: boolean;
  gridSize: number;
  setGridEnabled: (v: boolean) => void;
  setGridSize: (v: number) => void;
  /** Auto-layout parameters: direction and spacing presets */
  layoutDirection: LayoutDirection;
  layoutDensity: LayoutDensity;
  setLayoutDirection: (v: LayoutDirection) => void;
  setLayoutDensity: (v: LayoutDensity) => void;
  /** Snap threshold for alignment guides (px) */
  alignTolerance: number;
  setAlignTolerance: (v: number) => void;
  /** Format painter: copied node style (session state, not persisted) */
  styleBrush: FlowNodeStyle | null;
  setStyleBrush: (style: FlowNodeStyle | null) => void;
  /** Select all nodes and edges on the current page (excluding locked nodes) */
  selectAll: () => void;
  /** Clear the whole selection (Esc): also resets the selected flags on nodes/edges */
  clearSelection: () => void;
  /** Nudge selected nodes by direction key (writes no history; the caller merges them into one undo step) */
  nudgeSelected: (dx: number, dy: number) => void;

  /** Multi-page: page order and names; the active page lives in nodes/edges, other pages are cached in pageData */
  pageOrder: PageMeta[];
  activePageId: string;
  pageData: Record<string, FlowPage>;
  addPage: (name?: string) => void;
  /** Duplicate a page (all nodes/edges, ids remapped) and switch to the copy */
  duplicatePage: (id: string) => void;
  switchPage: (id: string) => void;
  renamePage: (id: string, name: string) => void;
  removePage: (id: string) => void;
  movePage: (id: string, dir: -1 | 1) => void;
  /** Paper size of the current page (absent means no page bounds) */
  pageSize: ShapeSize | undefined;
  /** Write the current page's paper size (pass undefined to clear the page bounds) */
  setPageSize: (size: ShapeSize | undefined) => void;

  /** Mouse wheel behavior (session state, persisted) */
  wheelMode: WheelMode;
  setWheelMode: (v: WheelMode) => void;
  /** Canvas background color (session state, persisted; `transparent` means transparent) */
  canvasBackground: string;
  setCanvasBackground: (v: string) => void;
  /** Canvas grid style (session state, persisted) */
  gridStyle: GridStyle;
  setGridStyle: (v: GridStyle) => void;
  /** Persistent guides (session state, persisted) */
  guides: CanvasGuide[];
  setGuides: (guides: CanvasGuide[]) => void;
  /** Whether to show the rulers */
  rulersVisible: boolean;
  setRulersVisible: (v: boolean) => void;

  /** When keepHistory is true the undo stack is preserved (used for snapshot rollback) */
  load: (doc: FlowDoc | null, keepHistory?: boolean) => void;
  getDoc: () => FlowDoc;
  /**
   * Insert an external document (e.g. mxGraph pasted from draw.io) into the current page.
   * Remaps every node/edge id (including parent-child links), shifts the content to `at` and selects the new elements.
   * Returns the number of inserted nodes (0 means empty content or over the limit).
   */
  insertDoc: (doc: FlowDoc, at: { x: number; y: number }) => number;

  commit: () => void;
  undo: () => void;
  redo: () => void;
  /** Rebuild the history baseline after loading a document (keeps the undo stack when keep is true) */
  resetHistory: (keep?: boolean) => void;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  /** Reconnect: drag one end of an existing edge onto a new node/anchor */
  reconnectEdge: (edgeId: string, connection: Connection) => void;
  /** Change the node an edge's source/target connects to (property panel dropdown) */
  setEdgeEndpoint: (edgeId: string, end: 'source' | 'target', nodeId: string) => void;
  /** Write or clear edge waypoints (an empty array clears them) */
  setEdgeWaypoints: (edgeId: string, waypoints: Waypoint[] | undefined, history?: boolean) => void;
  /** Run orthogonal auto-routing on the selected edges (avoiding other nodes' bounding boxes) */
  autoRouteSelectedEdges: () => void;
  /** Orthogonal obstacle-avoiding routing: route the selected edges or all edges on the page and mark routing=orthogonal */
  autoRouteEdges: (scope: 'selected' | 'all') => void;
  onSelectionChange: (selection: { nodes: FlowNode[]; edges: FlowEdge[] }) => void;
  /** Deselect edges only (keeping node selection): yields the edge selection state when starting a new connection */
  deselectEdges: () => void;

  /** Default style for new edges (adjustable from the toolbar: line type / width / style / end arrows) */
  defaultEdge: FlowEdgeStyle;
  setDefaultEdge: (patch: Partial<FlowEdgeStyle>) => void;
  /** Create a new node at the given absolute coordinates (same kind by default, kind can be overridden) and connect it to the source node; returns the new node id */
  spawnConnectedNode: (
    sourceId: string,
    position: { x: number; y: number },
    kind?: ShapeKind,
  ) => string | undefined;
  /** Change a node's shape kind (position and edges are kept; size/default style follow the new kind) */
  changeNodeKind: (id: string, kind: ShapeKind) => void;

  addNode: (kind: ShapeKind, position: { x: number; y: number }) => void;
  /** Insert a non-shape node (image / icon / formula) and return the new node id */
  addTypedNode: (
    type: FlowNodeType,
    data: FlowNodeData,
    size: { width: number; height: number },
    position: { x: number; y: number },
  ) => string;
  /** Rewrite the LaTeX source of a formula node */
  setNodeFormula: (id: string, formula: string, history?: boolean) => void;
  /** Collapse / expand a container (swimlane / group): collapsing hides its child nodes on the canvas */
  toggleContainerCollapsed: (id: string, collapsed?: boolean) => void;
  reparentNode: (id: string) => void;
  /** Ownership check after a drag ends (layer panel: dropped into a container / back to the canvas top level) */
  reparentNodeTo: (id: string, parentId?: string) => void;
  /** Layer ordering: move a node before the target node (keeping the parent-before-child invariant) */
  reorderNode: (id: string, targetId: string) => void;
  setNodeLabel: (id: string, label: string, history?: boolean) => void;
  /** Write table data of a table node (row/column add & remove / merge & split / styles) */
  setNodeTable: (id: string, table: TableData, history?: boolean) => void;
  /** Write the text of a table cell */
  setTableCellText: (id: string, row: number, col: number, text: string, history?: boolean) => void;
  patchSelected: (patch: FlowNodePatch, history?: boolean) => void;
  /** Geometry edit (property panel X / Y / W / H): X / Y are absolute canvas coordinates; only the given fields change */
  setNodeGeometry: (ids: string[], patch: NodeGeometryPatch, history?: boolean) => void;
  /** Write adjustable shape parameters (merged into style.shapeParams; keys are the parameter keys declared by the shape catalog) */
  setNodeParams: (ids: string[], params: Record<string, number>, history?: boolean) => void;
  /**
   * Write node transform (rotation / mirror).
   * Passing `undefined` clears the field (back to the default: 0° / no mirror).
   */
  setNodeTransform: (ids: string[], patch: NodeTransformPatch, history?: boolean) => void;
  /**
   * Multi-select group resize: scale each node's absolute coordinates and size by the bounding-box ratio.
   * `originals` is the snapshot taken when the drag started (absolute coordinates + size), preventing error accumulation.
   */
  scaleSelection: (
    originals: GroupScaleItem[],
    box: { x: number; y: number },
    sx: number,
    sy: number,
  ) => void;
  /** Clear an adjustable shape parameter (back to the shape catalog default) */
  clearNodeParam: (ids: string[], key: string, history?: boolean) => void;
  patchEdgeLabel: (id: string, label: string, history?: boolean) => void;
  /**
   * Write edge label fields: main label (label) / source label / target label.
   * An empty string counts as clearing, so no meaningless empty strings are left in the document.
   */
  setEdgeLabelField: (
    id: string,
    field: 'label' | 'sourceLabel' | 'targetLabel',
    value: string,
    history?: boolean,
  ) => void;
  /** Write the main label's position along the path (center / nearSource / nearTarget) */
  setEdgeLabelPosition: (id: string, position: EdgeLabelPosition, history?: boolean) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  applyAutoLayout: (options?: LayoutOptions) => void;
  clear: () => void;
  setHelperLines: (lines: HelperLines | null) => void;
}

/**
 * `getDoc` serialization cache for the active page (performance optimization).
 *
 * Thumbnail derivation (FlowchartTool's `pages` useMemo) calls getDoc on every nodes/edges change,
 * and serializing the active page means walking every node, copying styles and handling image base64.
 * Memoized on the nodes/edges array references: reused when no edit happened (e.g. only the title changed
 * or a side panel was switched) and invalidated automatically once the references change after an edit.
 */
let activePageMemo: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  recNodes: FlowNodeRec[];
  recEdges: FlowEdgeRec[];
} | null = null;

export const useFlowStore = create<FlowState>((set, get) => ({
  // Undo/redo: structural diff history (see store/history.ts)
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
  wheelMode: 'pan',
  canvasBackground: 'transparent',
  gridStyle: 'dots',
  guides: [],
  rulersVisible: false,
  styleBrush: null,
  pageOrder: [{ id: DEFAULT_PAGE_ID, name: DEFAULT_PAGE_NAME }],
  activePageId: DEFAULT_PAGE_ID,
  pageData: {},
  pageSize: undefined,

  setClipboard: (clip) => set({ clipboard: clip }),

  setGridEnabled: (v) => set({ gridEnabled: v }),
  setGridSize: (v) => set({ gridSize: v }),
  setLayoutDirection: (v) => set({ layoutDirection: v }),
  setLayoutDensity: (v) => set({ layoutDensity: v }),
  setAlignTolerance: (v) => set({ alignTolerance: v }),
  setWheelMode: (v) => set({ wheelMode: v }),
  setCanvasBackground: (v) => set({ canvasBackground: v }),
  setGridStyle: (v) => set({ gridStyle: v }),
  setGuides: (guides) => set({ guides }),
  setRulersVisible: (v) => set({ rulersVisible: v }),
  setStyleBrush: (style) => set({ styleBrush: style }),

  selectAll: () =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.selectable === false ? n : { ...n, selected: true })),
      edges: s.edges.map((e) => ({ ...e, selected: true })),
      selectedNodes: s.nodes.filter((n) => n.selectable !== false).map((n) => n.id),
      selectedEdges: s.edges.map((e) => e.id),
    })),

  clearSelection: () => {
    const { nodes, edges, selectedNodes, selectedEdges } = get();
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
    const nodeSet = new Set(selectedNodes);
    const edgeSet = new Set(selectedEdges);
    set({
      nodes: nodes.map((n) => (nodeSet.has(n.id) && n.selected ? { ...n, selected: false } : n)),
      edges: edges.map((e) => (edgeSet.has(e.id) && e.selected ? { ...e, selected: false } : e)),
      selectedNodes: [],
      selectedEdges: [],
    });
  },

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
    // Push the current state first so a rollback can still be undone; the history stack is kept, not cleared
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
      pageSize: undefined as ShapeSize | undefined,
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
    // Restore page by page after migrating to v2: legacy v1 drafts still load, and the multi-page structure is preserved
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
      pageSize: page.size,
      selectedNodes: [],
      selectedEdges: [],
    });
    // Loading sets a new history baseline: the undo stack is cleared unless explicitly kept
    get().resetHistory(keepHistory);
  },

  getDoc: () => {
    const { nodes, edges, pageOrder, activePageId, pageData, docName } = get();
    // Serialize the active page on demand; reuse the previous result while nodes/edges references are unchanged (see activePageMemo)
    let recNodes: FlowNodeRec[];
    let recEdges: FlowEdgeRec[];
    if (activePageMemo && activePageMemo.nodes === nodes && activePageMemo.edges === edges) {
      recNodes = activePageMemo.recNodes;
      recEdges = activePageMemo.recEdges;
    } else {
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
            sourceLabel: data?.sourceLabel,
            targetLabel: data?.targetLabel,
            labelPosition: data?.labelPosition,
            style: data?.style,
            waypoints: data?.waypoints,
            mxStyle: data?.mxStyle,
          };
        }),
      );
      const currentPage = current.pages[0];
      recNodes = currentPage.nodes;
      recEdges = currentPage.edges;
      activePageMemo = { nodes, edges, recNodes, recEdges };
    }
    const pages: FlowPage[] = pageOrder.map((meta) => {
      if (meta.id === activePageId) {
        return {
          id: meta.id,
          name: meta.name,
          nodes: recNodes,
          edges: recEdges,
          ...(get().pageSize ? { size: get().pageSize } : {}),
        };
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
      version: 3,
      ...(docName ? { name: docName } : {}),
      pages,
      activePageId,
    };
  },

  insertDoc: (doc, at) => {
    const page = activePageOf(doc);
    if (!page || page.nodes.length === 0) return 0;
    // Upper bound: keep an abnormally large clipboard payload from being dumped into the current page at once
    const source = page.nodes.slice(0, MAX_PASTE_NODES);
    const idMap = new Map<string, string>();
    for (const n of source) idMap.set(n.id, createId('n'));
    const minX = Math.min(...source.map((n) => n.position.x));
    const minY = Math.min(...source.map((n) => n.position.y));
    const nextNodes: FlowNodeRec[] = source.map((n) => ({
      ...n,
      id: idMap.get(n.id)!,
      // Shift so the content's top-left corner aligns with `at`
      position: {
        x: Math.round(n.position.x - minX + at.x),
        y: Math.round(n.position.y - minY + at.y),
      },
      parentId: n.parentId ? (idMap.get(n.parentId) ?? null) : null,
    }));
    const nextEdges: FlowEdgeRec[] = page.edges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e) => ({
        ...e,
        id: createId('e'),
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
      }));
    const nextPage: FlowPage = { ...page, nodes: nextNodes, edges: nextEdges };
    const createdNodes = nodesFromPage(nextPage);
    const createdEdges = edgesFromPage(nextPage);
    const ids = createdNodes.map((n) => n.id);
    get().commit();
    set((s) => ({
      nodes: selectOnly(orderNodesByHierarchy([...s.nodes, ...createdNodes]), ids),
      edges: [...s.edges, ...createdEdges],
      selectedNodes: ids,
      selectedEdges: [],
    }));
    return createdNodes.length;
  },

  onNodesChange: (changes) => {
    /**
     * Container resize linkage: while NodeResizer drags (resizing + setAttributes), convert child nodes proportionally.
     * Only containers whose size really changed are processed, O(child count), leaving normal drag/select flows untouched.
     */
    const before = get().nodes;
    const childPatches = new Map<string, ScaledChild>();
    for (const change of changes) {
      if (change.type !== 'dimensions' || change.resizing !== true || !change.dimensions) continue;
      const container = before.find((n) => n.id === change.id);
      if (!container || !isContainerKind(container.data.kind)) continue;
      const prev = {
        width: container.width ?? shapeSize(container.data.kind).width,
        height: container.height ?? shapeSize(container.data.kind).height,
      };
      const next = { width: change.dimensions.width, height: change.dimensions.height };
      const children = before
        .filter((n) => n.parentId === container.id)
        .map((n) => ({
          id: n.id,
          kind: n.data.kind,
          position: n.position,
          width: n.width,
          height: n.height,
        }));
      for (const patch of scaleChildren(children, prev, next)) childPatches.set(patch.id, patch);
    }

    set((s) => {
      let nodes = applyNodeChanges(changes, s.nodes) as FlowNode[];
      if (childPatches.size > 0) {
        nodes = nodes.map((n) => {
          const patch = childPatches.get(n.id);
          return patch
            ? { ...n, position: patch.position, width: patch.width, height: patch.height }
            : n;
        });
      }
      return { nodes };
    });
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
    // No change, so nothing is written to history
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
    if (nodeId === otherId) return; // self-connections are not allowed
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
    // Anchor on the new node's side facing the opposite end
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
    // Waypoints follow the grid snap setting: align to the grid when enabled, otherwise just round
    const { gridEnabled, gridSize } = get();
    const snap = (v: number) =>
      gridEnabled && gridSize > 1 ? Math.round(v / gridSize) * gridSize : Math.round(v);
    const next =
      waypoints && waypoints.length > 0
        ? waypoints.map((p) => ({ x: snap(p.x), y: snap(p.y) }))
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

  autoRouteSelectedEdges: () => get().autoRouteEdges('selected'),

  autoRouteEdges: (scope) => {
    const { edges, selectedEdges, nodes } = get();
    const selected = new Set(selectedEdges);
    const targets = edges.filter((e) => scope === 'all' || selected.has(e.id));
    if (targets.length === 0) return;
    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    const obstacles = nodes
      .filter((n) => n.hidden !== true)
      .map((n) => ({ id: n.id, ...absoluteRectOf(n, byId) }));

    const requests = targets.flatMap((e) => {
      const source = byId.get(e.source);
      const target = byId.get(e.target);
      if (!source || !target) return [];
      const from = anchorOf(source, byId, e.sourceHandle, target);
      const to = anchorOf(target, byId, e.targetHandle, source);
      return [
        {
          id: e.id,
          from: stubPoint(from.point, from.side),
          to: stubPoint(to.point, to.side),
          fromSide: from.side,
          toSide: to.side,
          exclude: [e.source, e.target],
        },
      ];
    });
    if (requests.length === 0) return;

    const results = routeEdges({ edges: requests, obstacles });
    const byEdge = new Map(results.map((r) => [r.edgeId, r] as const));
    let changed = false;
    const nextEdges = edges.map((e) => {
      const result = byEdge.get(e.id);
      if (!result) return e;
      changed = true;
      const data: FlowEdgeData = {
        ...(e.data as FlowEdgeData | undefined),
        waypoints: result.waypoints,
        routing: 'orthogonal',
      };
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
    // Pick the most suitable anchor from the relative bearing of the source node and the new node's center
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
              // Changing the shape replaces only the kind and size: text, user colors and other styles are kept as-is
              data: { ...n.data, kind, style: { ...n.data.style } },
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
    // Nesting containers is not supported (consistent with canvas dragging)
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
      // Keep the visual position in relative coordinates and clamp it inside the container (so children never sit outside)
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

  setNodeTable: (id, table, history = true) => {
    if (history) get().commit();
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, table } } : n)),
    }));
  },

  setTableCellText: (id, row, col, text, history = true) => {
    const node = get().nodes.find((n) => n.id === id);
    const table = normalizeTable((node?.data as FlowNodeData | undefined)?.table);
    get().setNodeTable(id, setCellText(table, row, col, text), history);
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

  setEdgeLabelField: (id, field, value, history = true) => {
    const current = get().edges.find((e) => e.id === id);
    if (!current) return;
    const prev =
      field === 'label' ? (typeof current.label === 'string' ? current.label : '') : undefined;
    if (field === 'label' && prev === value) return;
    if (history) get().commit();
    set((s) => ({
      edges: s.edges.map((e) => {
        if (e.id !== id) return e;
        if (field === 'label') return { ...e, label: value };
        const data: FlowEdgeData = { ...(e.data as FlowEdgeData | undefined) };
        if (value) data[field] = value;
        else delete data[field];
        return { ...e, data };
      }),
    }));
  },

  setEdgeLabelPosition: (id, position, history = true) => {
    if (history) get().commit();
    set((s) => ({
      edges: s.edges.map((e) => {
        if (e.id !== id) return e;
        const data: FlowEdgeData = { ...(e.data as FlowEdgeData | undefined) };
        // center is the default, so the field is not written
        if (position === 'center') delete data.labelPosition;
        else data.labelPosition = position;
        return { ...e, data };
      }),
    }));
  },

  setNodeGeometry: (ids, patch, history = true) => {
    const target = new Set(ids);
    if (target.size === 0) return;
    const hasMove = patch.x !== undefined || patch.y !== undefined;
    const hasSize = patch.width !== undefined || patch.height !== undefined;
    if (!hasMove && !hasSize) return;
    const { nodes } = get();
    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    if (history) get().commit();
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (!target.has(n.id)) return n;
        const next = { ...n };
        if (hasSize) {
          const min = minNodeSize(n.data.kind);
          if (patch.width !== undefined) {
            next.width = Math.max(min.width, Math.round(patch.width));
          }
          if (patch.height !== undefined) {
            next.height = Math.max(min.height, Math.round(patch.height));
          }
        }
        if (hasMove) {
          // The input field gives absolute canvas coordinates: convert back to relative coordinates when there is a parent container
          const parent = n.parentId ? byId.get(n.parentId) : undefined;
          const base = parent ? absolutePositionOf(parent, byId) : { x: 0, y: 0 };
          const absX = patch.x ?? base.x + n.position.x;
          const absY = patch.y ?? base.y + n.position.y;
          next.position = { x: Math.round(absX - base.x), y: Math.round(absY - base.y) };
        }
        return next;
      }),
    }));
  },

  setNodeParams: (ids, params, history = true) => {
    const target = new Set(ids);
    if (target.size === 0 || Object.keys(params).length === 0) return;
    if (history) get().commit();
    set((s) => ({
      nodes: s.nodes.map((n) =>
        target.has(n.id)
          ? {
              ...n,
              data: {
                ...n.data,
                style: {
                  ...n.data.style,
                  shapeParams: { ...n.data.style.shapeParams, ...params },
                },
              },
            }
          : n,
      ),
    }));
  },

  clearNodeParam: (ids, key, history = true) => {
    const target = new Set(ids);
    if (target.size === 0) return;
    if (history) get().commit();
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (!target.has(n.id)) return n;
        const prev = n.data.style.shapeParams;
        if (!prev || prev[key] === undefined) return n;
        const next = { ...prev };
        delete next[key];
        // Legacy field compatibility: remove the old fields when clearing the fold/corner radius to avoid falling back to old values
        const style = { ...n.data.style, shapeParams: next };
        if (key === 'foldSize') delete style.foldSize;
        if (key === 'cornerRadius') delete style.cornerRadius;
        return { ...n, data: { ...n.data, style } };
      }),
    }));
  },

  scaleSelection: (originals, box, sx, sy) => {
    if (originals.length === 0) return;
    if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx <= 0 || sy <= 0) return;
    const state = get();
    const byId = new Map(state.nodes.map((n) => [n.id, n] as const));
    const next = new Map<string, GroupScaleItem>();
    for (const item of originals) {
      const node = byId.get(item.id);
      if (!node || node.draggable === false) continue;
      const min = minNodeSize(node.data.kind);
      next.set(item.id, {
        id: item.id,
        absX: box.x + (item.absX - box.x) * sx,
        absY: box.y + (item.absY - box.y) * sy,
        width: Math.max(min.width, item.width * sx),
        height: Math.max(min.height, item.height * sy),
      });
    }
    if (next.size === 0) return;
    set((s) => ({
      nodes: s.nodes.map((n) => {
        const item = next.get(n.id);
        if (!item) return n;
        const parent = n.parentId ? byId.get(n.parentId) : undefined;
        const base = parent ? absolutePositionOf(parent, byId) : { x: 0, y: 0 };
        return {
          ...n,
          position: {
            x: Math.round(item.absX - base.x),
            y: Math.round(item.absY - base.y),
          },
          width: Math.round(item.width),
          height: Math.round(item.height),
        };
      }),
    }));
  },

  toggleContainerCollapsed: (id, collapsed) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node || !isContainerKind(node.data.kind)) return;
    const next = collapsed ?? node.data.collapsed !== true;
    if ((node.data.collapsed === true) === next) return;
    get().commit();
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, collapsed: next ? true : undefined } } : n,
      ),
    }));
  },

  setNodeTransform: (ids, patch, history = true) => {
    const target = new Set(ids);
    if (target.size === 0) return;
    const keys = Object.keys(patch) as Array<keyof NodeTransformPatch>;
    if (keys.length === 0) return;
    if (history) get().commit();
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (!target.has(n.id)) return n;
        const style = { ...n.data.style };
        for (const key of keys) {
          const value = patch[key];
          if (key === 'rotation') {
            if (value === undefined) delete style.rotation;
            // Clear the field when it normalizes to 0, avoiding a redundant rotation: 0 in the document
            else style.rotation = normalizeRotation(value as number) || undefined;
          } else if (key === 'flipH') {
            if (value) style.flipH = true;
            else delete style.flipH;
          } else {
            if (value) style.flipV = true;
            else delete style.flipV;
          }
        }
        return { ...n, data: { ...n.data, style } };
      }),
    }));
  },

  removeSelected: () => {
    const { selectedNodes, selectedEdges } = get();
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
    get().commit();
    const nodeSet = new Set(selectedNodes);
    // Deleting a swimlane also deletes its child nodes, so none are left orphaned
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
    // Two-pass layout keeps the swimlane/group hierarchy by default: container positions and inner relative coordinates are reflowed together
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
      // Cache the current page's content first, then switch to a blank new page
      pageData: { ...state.pageData, ...(cur ? { [state.activePageId]: cur } : {}) },
      nodes: [],
      edges: [],
      selectedNodes: [],
      selectedEdges: [],
      // The new page inherits the current page's paper settings for continuous paging
      pageSize: state.pageSize,
    });
  },

  duplicatePage: (id) => {
    const state = get();
    const doc = state.getDoc();
    const source = doc.pages.find((p) => p.id === id);
    if (!source) return;
    const newId = createId('page');
    // Deep-copy and remap ids so the copy shares no identifiers with the source page
    const idMap = new Map<string, string>();
    for (const n of source.nodes) idMap.set(n.id, createId('n'));
    const nodes = source.nodes.map((n) => ({
      ...n,
      id: idMap.get(n.id)!,
      position: { ...n.position },
      data: { ...n.data, style: { ...n.data.style } },
      parentId: n.parentId ? (idMap.get(n.parentId) ?? null) : null,
    }));
    const edges = source.edges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e) => ({
        ...e,
        id: createId('e'),
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
      }));
    const copy: FlowPage = { id: newId, name: copyPageName(source.name), nodes, edges };
    const idx = doc.pages.findIndex((p) => p.id === id);
    const nextOrder = [...state.pageOrder];
    nextOrder.splice(idx < 0 ? nextOrder.length : idx + 1, 0, {
      id: newId,
      name: copy.name,
    });
    const cur = doc.pages.find((p) => p.id === state.activePageId);
    set({
      pageOrder: nextOrder,
      activePageId: newId,
      pageData: {
        ...state.pageData,
        ...(cur ? { [state.activePageId]: cur } : {}),
      },
      nodes: nodesFromPage(copy),
      edges: edgesFromPage(copy),
      pageSize: source.size,
      selectedNodes: [],
      selectedEdges: [],
    });
  },

  setPageSize: (size) => {
    set({
      pageSize:
        size && size.width >= MIN_PAGE_SIZE && size.height >= MIN_PAGE_SIZE
          ? { width: Math.round(size.width), height: Math.round(size.height) }
          : undefined,
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
      pageSize: target.size,
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
    // Deleting the current page: switch to an adjacent page and load its content
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
      pageSize: target.size,
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

/* ------------------------------ Compatibility exports ------------------------------ */
// The implementation now lives in store/helpers.ts and store/history.ts; the public API is unchanged,
// so call sites (UI / flowOps / unit tests) need no changes.

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
