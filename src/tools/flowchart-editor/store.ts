/**
 * 流程图编辑器状态：单一真相源是 nodes / edges，其余（选中 / 历史）是会话态。
 * 所有结构性变更前先 commit() 压入历史快照，保证 undo / redo 可回放（复用 slide-editor 模式）。
 */

import { create } from 'zustand';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { createId, defaultData, serializeDoc, type HelperLines } from './core';
import {
  type FlowDoc,
  type FlowNodeData,
  type FlowNodePatch,
  type ShapeKind,
  shapeSize,
} from './model/types';
import { layoutGraph } from './layout';

const HISTORY_LIMIT = 50;

export type FlowNode = Node<FlowNodeData>;
export type FlowEdge = Edge;

interface Snapshot {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

function makeNode(kind: ShapeKind, position: { x: number; y: number }, id?: string): FlowNode {
  const size = shapeSize(kind);
  return {
    id: id ?? createId('n'),
    type: 'shape',
    position,
    // 显式尺寸：让 React Flow 在测量前就有正确包围盒（fitView / 导出 / 自动布局均依赖）
    width: size.width,
    height: size.height,
    data: defaultData(kind),
  };
}

function makeEdge(connection: Connection | FlowEdge): FlowEdge {
  return {
    ...connection,
    id: (connection as FlowEdge).id ?? createId('e'),
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, color: '#475569', width: 18, height: 18 },
  } as FlowEdge;
}

interface FlowState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNodes: string[];
  selectedEdges: string[];
  past: Snapshot[];
  future: Snapshot[];
  helperLines: HelperLines | null;

  load: (doc: FlowDoc | null) => void;
  getDoc: () => FlowDoc;

  commit: () => void;
  undo: () => void;
  redo: () => void;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onSelectionChange: (selection: { nodes: FlowNode[]; edges: FlowEdge[] }) => void;

  addNode: (kind: ShapeKind, position: { x: number; y: number }) => void;
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

  load: (doc) => {
    if (!doc) {
      set({ nodes: [], edges: [], past: [], future: [], selectedNodes: [], selectedEdges: [] });
      return;
    }
    const nodes: FlowNode[] = doc.nodes.map((n) => {
      const size = shapeSize(n.data.kind);
      return {
        id: n.id,
        type: 'shape',
        position: { ...n.position },
        width: size.width,
        height: size.height,
        data: { kind: n.data.kind, label: n.data.label, style: { ...n.data.style } },
      };
    });
    const edges: FlowEdge[] = doc.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      label: e.label,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#475569', width: 18, height: 18 },
    }));
    set({
      nodes,
      edges,
      past: [],
      future: [],
      selectedNodes: [],
      selectedEdges: [],
    });
  },

  getDoc: () => {
    const { nodes, edges } = get();
    return serializeDoc(
      nodes.map((n) => ({ id: n.id, position: n.position, data: n.data })),
      edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: typeof e.label === 'string' ? e.label : undefined,
      })),
    );
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
    set((s) => ({ edges: addEdge(makeEdge(connection), s.edges) }));
  },

  onSelectionChange: (selection) =>
    set({
      selectedNodes: selection.nodes.map((n) => n.id),
      selectedEdges: selection.edges.map((e) => e.id),
    }),

  addNode: (kind, position) => {
    get().commit();
    const node = makeNode(kind, position);
    set((s) => ({ nodes: [...s.nodes, node], selectedNodes: [node.id] }));
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
    set((s) => ({ nodes: [...s.nodes, ...copies], selectedNodes: copies.map((c) => c.id) }));
  },

  applyAutoLayout: (direction = 'TB') => {
    get().commit();
    set((s) => ({ nodes: layoutGraph(s.nodes, s.edges, direction) }));
  },

  clear: () => {
    get().commit();
    set({ nodes: [], edges: [], selectedNodes: [], selectedEdges: [] });
  },

  setHelperLines: (lines) => set({ helperLines: lines }),
}));
