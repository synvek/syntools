/**
 * 复合编辑操作（对齐、分布、层级、编组、剪贴板、边样式）。
 * 通过 store 的 setState/getState 操作，避免在单个 store 文件里堆叠过多逻辑。
 */

import { useFlowStore } from './store';
import {
  absolutePositionOf,
  absoluteRectOf,
  createId,
  defaultData,
  orderNodesByHierarchy,
} from './core';
import { isContainerKind, type FlowEdgeStyle } from './model/types';
import {
  computeAlign,
  computeDistribute,
  edgePropsOf,
  groupBounds,
  normalizeEdgeStyle,
  reorderLayers,
  type AlignMode,
  type LayerOp,
  type LayoutBox,
} from './ops';

type MoveMap = Record<string, { x: number; y: number }>;

/** 选中且非容器的节点，返回其画布绝对包围盒（容器不参与排版） */
function selectedBoxes(): LayoutBox[] {
  const { nodes, selectedNodes } = useFlowStore.getState();
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const boxes: LayoutBox[] = [];
  for (const id of selectedNodes) {
    const node = byId.get(id);
    if (!node || isContainerKind(node.data.kind)) continue;
    boxes.push({ id, ...absoluteRectOf(node, byId) });
  }
  return boxes;
}

/** 把绝对坐标的位移结果写回节点（有父节点时转回相对坐标） */
function applyAbsoluteMoves(moves: MoveMap): void {
  if (Object.keys(moves).length === 0) return;
  const nodes = useFlowStore.getState().nodes;
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  useFlowStore.setState({
    nodes: nodes.map((n) => {
      const moved = moves[n.id];
      if (!moved) return n;
      const parent = n.parentId ? byId.get(n.parentId) : undefined;
      const base = parent ? absolutePositionOf(parent, byId) : { x: 0, y: 0 };
      return { ...n, position: { x: moved.x - base.x, y: moved.y - base.y } };
    }),
  });
}

export function alignSelected(mode: AlignMode): void {
  const boxes = selectedBoxes();
  if (boxes.length < 2) return;
  useFlowStore.getState().commit();
  applyAbsoluteMoves(computeAlign(boxes, mode));
}

export function distributeSelected(axis: 'h' | 'v'): void {
  const boxes = selectedBoxes();
  if (boxes.length < 3) return;
  useFlowStore.getState().commit();
  applyAbsoluteMoves(computeDistribute(boxes, axis));
}

/** 层级调整后重新归一顺序，确保容器仍在子节点之前 */
export function layerOp(op: LayerOp): void {
  const { nodes, selectedNodes } = useFlowStore.getState();
  if (selectedNodes.length === 0) return;
  const selected = new Set(selectedNodes);
  const reordered = orderNodesByHierarchy(reorderLayers(nodes, selected, op));
  useFlowStore.getState().commit();
  useFlowStore.setState({ nodes: reordered });
}

/** 把选中的普通节点装进一个新的编组容器 */
export function groupSelected(): void {
  const { nodes, selectedNodes } = useFlowStore.getState();
  if (selectedNodes.length === 0) return;
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const targetIds = new Set(
    nodes
      .filter((n) => selectedNodes.includes(n.id) && !isContainerKind(n.data.kind))
      .map((n) => n.id),
  );
  if (targetIds.size === 0) return;

  const boxes: LayoutBox[] = nodes
    .filter((n) => targetIds.has(n.id))
    .map((n) => ({ id: n.id, ...absoluteRectOf(n, byId) }));
  const bounds = groupBounds(boxes);
  if (!bounds) return;

  const padX = 24;
  const padTop = 46; // 编组标题栏 + 间距
  const padBottom = 20;
  const groupPos = { x: bounds.x - padX, y: bounds.y - padTop };
  const groupId = createId('g');

  const updated = nodes.map((n) => {
    if (!targetIds.has(n.id)) return n;
    const abs = absolutePositionOf(n, byId);
    return {
      ...n,
      parentId: groupId,
      position: { x: Math.round(abs.x - groupPos.x), y: Math.round(abs.y - groupPos.y) },
    };
  });

  const groupNode = {
    id: groupId,
    type: 'shape' as const,
    position: groupPos,
    width: bounds.width + padX * 2,
    height: bounds.height + padTop + padBottom,
    data: defaultData('group'),
  };

  useFlowStore.getState().commit();
  useFlowStore.setState({
    nodes: orderNodesByHierarchy([...updated, groupNode]),
    selectedNodes: [groupId],
  });
}

/** 解散选中的编组：子节点转回绝对坐标并保留 */
export function ungroupSelected(): void {
  const { nodes, selectedNodes } = useFlowStore.getState();
  const groupIds = new Set(
    nodes.filter((n) => selectedNodes.includes(n.id) && n.data.kind === 'group').map((n) => n.id),
  );
  if (groupIds.size === 0) return;

  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const next = orderNodesByHierarchy(
    nodes
      .filter((n) => !groupIds.has(n.id))
      .map((n) => {
        if (!n.parentId || !groupIds.has(n.parentId)) return n;
        return { ...n, parentId: undefined, position: absolutePositionOf(n, byId) };
      }),
  );
  useFlowStore.getState().commit();
  useFlowStore.setState({ nodes: next, selectedNodes: [] });
}

export function copySelection(): void {
  const { nodes, edges, selectedNodes } = useFlowStore.getState();
  if (selectedNodes.length === 0) return;
  const ids = new Set(selectedNodes);
  const picked = nodes.filter((n) => ids.has(n.id));
  const pickedEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  useFlowStore.setState({ clipboard: { nodes: picked, edges: pickedEdges } });
}

export function pasteClipboard(): void {
  const clipboard = useFlowStore.getState().clipboard;
  if (!clipboard || clipboard.nodes.length === 0) return;

  const idMap = new Map<string, string>();
  const copies = clipboard.nodes.map((n) => {
    const newId = createId('n');
    idMap.set(n.id, newId);
    return {
      ...n,
      id: newId,
      position: { x: n.position.x + 24, y: n.position.y + 24 },
      selected: false,
      data: { ...n.data, style: { ...n.data.style } },
    };
  });
  const copyEdges = clipboard.edges.map((e) => ({
    ...e,
    id: createId('e'),
    source: idMap.get(e.source) ?? e.source,
    target: idMap.get(e.target) ?? e.target,
  }));

  const state = useFlowStore.getState();
  state.commit();
  useFlowStore.setState({
    nodes: orderNodesByHierarchy([...state.nodes, ...copies]),
    edges: [...state.edges, ...copyEdges],
    selectedNodes: copies.map((c) => c.id),
  });
}

/** 修改选中连线的样式（缺失字段用默认值补齐） */
export function patchSelectedEdgeStyle(patch: Partial<FlowEdgeStyle>): void {
  const { edges, selectedEdges } = useFlowStore.getState();
  if (selectedEdges.length === 0) return;
  useFlowStore.getState().commit();
  useFlowStore.setState({
    edges: edges.map((e) => {
      if (!selectedEdges.includes(e.id)) return e;
      const current = normalizeEdgeStyle(
        (e.data as { style?: Partial<FlowEdgeStyle> } | undefined)?.style,
      );
      const next = normalizeEdgeStyle({ ...current, ...patch });
      return { ...e, data: { ...(e.data ?? {}), style: next }, ...edgePropsOf(next) };
    }),
  });
}

/** 当前选中连线的样式（供属性面板回显） */
export function selectedEdgeStyle(): FlowEdgeStyle {
  const { edges, selectedEdges } = useFlowStore.getState();
  const first = edges.find((e) => e.id === selectedEdges[0]);
  return normalizeEdgeStyle((first?.data as { style?: Partial<FlowEdgeStyle> } | undefined)?.style);
}

/** 切换可见性：只要有一个可见就整体隐藏，否则全部显示 */
export function toggleHidden(ids: string[]): void {
  if (ids.length === 0) return;
  const nodes = useFlowStore.getState().nodes;
  const target = new Set(ids);
  const shouldHide = nodes.some((n) => target.has(n.id) && n.hidden !== true);
  useFlowStore.getState().commit();
  useFlowStore.setState({
    nodes: nodes.map((n) => (target.has(n.id) ? { ...n, hidden: shouldHide } : n)),
  });
}

/** 切换锁定：锁定后不可拖动 / 不可选中 */
export function toggleLocked(ids: string[]): void {
  if (ids.length === 0) return;
  const nodes = useFlowStore.getState().nodes;
  const target = new Set(ids);
  const shouldLock = nodes.some((n) => target.has(n.id) && n.draggable !== false);
  useFlowStore.getState().commit();
  useFlowStore.setState({
    nodes: nodes.map((n) =>
      target.has(n.id) ? { ...n, draggable: !shouldLock, selectable: !shouldLock } : n,
    ),
  });
}

/** 重命名节点（双击图层名称触发） */
export function renameNode(id: string, name: string): void {
  const nodes = useFlowStore.getState().nodes;
  const node = nodes.find((n) => n.id === id);
  if (!node || node.data.label === name) return;
  useFlowStore.getState().commit();
  useFlowStore.setState({
    nodes: nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: name } } : n)),
  });
}

/** 单个节点的层级调整（图层面板的上下箭头） */
export function moveNodeLayer(id: string, op: LayerOp): void {
  const { nodes } = useFlowStore.getState();
  if (!nodes.some((n) => n.id === id)) return;
  const reordered = orderNodesByHierarchy(reorderLayers(nodes, new Set([id]), op));
  useFlowStore.getState().commit();
  useFlowStore.setState({ nodes: reordered });
}
