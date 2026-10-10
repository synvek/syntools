/**
 * 复合编辑操作（对齐、分布、层级、编组、剪贴板、边样式）。
 * 通过 store 的 setState/getState 操作，避免在单个 store 文件里堆叠过多逻辑。
 */

import { selectOnly, useFlowStore } from './store';
import {
  absolutePositionOf,
  absoluteRectOf,
  createId,
  defaultData,
  normalizeRotation,
  orderNodesByHierarchy,
} from './core';
import { isContainerKind, type FlowEdgeStyle } from './model/types';
import { shapeSize } from './model/shapes';
import { themeOf, type ThemeId } from './model/themes';
import {
  computeAlign,
  computeAlignToRect,
  computeDistribute,
  computeDistributeInRect,
  edgePropsOf,
  groupBounds,
  normalizeEdgeStyle,
  reorderLayers,
  type AlignMode,
  type AlignRect,
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

/** 对齐参照范围：选中集合 / 画布整体 / 页面纸张 */
export type ArrangeScope = 'selection' | 'canvas' | 'page';

/** 分布方式：保持两端不动等间距 / 首尾贴住参照矩形两端 */
export type DistributeMode = 'spacing' | 'edges';

/** 画布参照矩形：所有可见节点的整体包围盒 */
function canvasRect(): AlignRect | null {
  const { nodes } = useFlowStore.getState();
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const boxes: LayoutBox[] = nodes
    .filter((n) => n.hidden !== true)
    .map((n) => ({ id: n.id, ...absoluteRectOf(n, byId) }));
  return groupBounds(boxes);
}

/** 页面参照矩形：纸张尺寸（未设置页面尺寸时返回 null） */
function pageRect(): AlignRect | null {
  const size = useFlowStore.getState().pageSize;
  return size ? { x: 0, y: 0, width: size.width, height: size.height } : null;
}

/** 按参照范围对齐选中节点 */
export function alignSelectedToScope(mode: AlignMode, scope: ArrangeScope = 'selection'): void {
  if (scope === 'selection') {
    alignSelected(mode);
    return;
  }
  const boxes = selectedBoxes();
  if (boxes.length === 0) return;
  const rect = scope === 'canvas' ? canvasRect() : pageRect();
  if (!rect) return;
  useFlowStore.getState().commit();
  applyAbsoluteMoves(computeAlignToRect(boxes, mode, rect));
}

/** 按参照范围分布选中节点（等间距或贴合两端） */
export function distributeSelectedInScope(
  axis: 'h' | 'v',
  scope: ArrangeScope = 'selection',
  mode: DistributeMode = 'spacing',
): void {
  if (scope === 'selection' && mode === 'spacing') {
    distributeSelected(axis);
    return;
  }
  const boxes = selectedBoxes();
  if (boxes.length < 2) return;
  const rect =
    scope === 'canvas' ? canvasRect() : scope === 'page' ? pageRect() : groupBounds(boxes);
  if (!rect) return;
  useFlowStore.getState().commit();
  applyAbsoluteMoves(computeDistributeInRect(boxes, axis, rect));
}

/**
 * 对齐增强：把选中节点的位置吸附到画布网格。
 * 位置按网格取整后写回（容器内的子节点自动换算回相对坐标）；
 * 未开启网格吸附、或已对齐时不产生历史记录。
 */
export function snapSelectedToGrid(): void {
  const { nodes, selectedNodes, gridEnabled, gridSize } = useFlowStore.getState();
  if (!gridEnabled || gridSize < 2) return;
  const targets = nodes.filter((n) => selectedNodes.includes(n.id) && n.draggable !== false);
  if (targets.length === 0) return;
  const byId = new Map(nodes.map((n) => [n.id, n] as const));

  const moves: MoveMap = {};
  let changed = false;
  for (const node of targets) {
    const abs = absolutePositionOf(node, byId);
    const snapped = {
      x: Math.round(abs.x / gridSize) * gridSize,
      y: Math.round(abs.y / gridSize) * gridSize,
    };
    moves[node.id] = snapped;
    if (Math.abs(abs.x - snapped.x) > 0.5 || Math.abs(abs.y - snapped.y) > 0.5) changed = true;
  }
  if (!changed) return;
  useFlowStore.getState().commit();
  applyAbsoluteMoves(moves);
}

/**
 * 统一尺寸：把选中的普通节点宽高统一为「第一个选中节点」的尺寸。
 * 容器不参与（容器尺寸由内容决定），至少需要两个可缩放节点；已一致时不写历史。
 */
export function applyUniformSize(): void {
  const { nodes, selectedNodes } = useFlowStore.getState();
  const targets = nodes.filter(
    (n) => selectedNodes.includes(n.id) && !isContainerKind(n.data.kind),
  );
  if (targets.length < 2) return;
  const ref = targets[0];
  const width = ref.width ?? shapeSize(ref.data.kind).width;
  const height = ref.height ?? shapeSize(ref.data.kind).height;
  const sameSize = targets.every(
    (n) =>
      (n.width ?? shapeSize(n.data.kind).width) === width &&
      (n.height ?? shapeSize(n.data.kind).height) === height,
  );
  if (sameSize) return;
  useFlowStore.getState().setNodeGeometry(
    targets.map((n) => n.id),
    { width, height },
    true,
  );
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

/**
 * 旋转选中节点（度，叠加到各自当前角度上，容器一并参与）。
 * 归一后为 0 时清除字段，避免文档里出现冗余的 `rotation: 0`。
 */
export function rotateSelected(delta: number): void {
  const { selectedNodes } = useFlowStore.getState();
  if (selectedNodes.length === 0 || delta === 0) return;
  const target = new Set(selectedNodes);
  useFlowStore.getState().commit();
  useFlowStore.setState((s) => ({
    nodes: s.nodes.map((n) => {
      if (!target.has(n.id)) return n;
      const rotation = normalizeRotation((n.data.style.rotation ?? 0) + delta) || undefined;
      return { ...n, data: { ...n.data, style: { ...n.data.style, rotation } } };
    }),
  }));
}

/**
 * 水平 / 垂直镜像。
 * 切换语义与「锁定 / 隐藏」一致：只要有一个选中节点未镜像就整体镜像，否则整体取消。
 */
export function flipSelected(axis: 'h' | 'v'): void {
  const { nodes, selectedNodes } = useFlowStore.getState();
  if (selectedNodes.length === 0) return;
  const key = axis === 'h' ? 'flipH' : 'flipV';
  const target = new Set(selectedNodes);
  const shouldFlip = nodes.some((n) => target.has(n.id) && n.data.style[key] !== true);
  useFlowStore.getState().commit();
  useFlowStore.setState((s) => ({
    nodes: s.nodes.map((n) => {
      if (!target.has(n.id)) return n;
      const style = { ...n.data.style };
      if (shouldFlip) style[key] = true;
      else delete style[key];
      return { ...n, data: { ...n.data, style } };
    }),
  }));
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
    nodes: selectOnly(orderNodesByHierarchy([...updated, groupNode]), [groupId]),
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
  useFlowStore.setState({ nodes: selectOnly(next, []), selectedNodes: [] });
}

export function copySelection(): void {
  const { nodes, edges, selectedNodes } = useFlowStore.getState();
  if (selectedNodes.length === 0) return;
  const ids = new Set(selectedNodes);
  const picked = nodes.filter((n) => ids.has(n.id));
  const pickedEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  useFlowStore.setState({ clipboard: { nodes: picked, edges: pickedEdges } });
}

/**
 * 剪切：先把选中节点复制进剪贴板，再删除。
 * 仅选中连线（无节点）时退化为删除连线（连线无法脱离节点单独粘贴）。
 */
export function cutSelection(): void {
  const { selectedNodes, selectedEdges } = useFlowStore.getState();
  if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
  copySelection();
  useFlowStore.getState().removeSelected();
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
  const ids = copies.map((c) => c.id);
  state.commit();
  useFlowStore.setState({
    nodes: selectOnly(orderNodesByHierarchy([...state.nodes, ...copies]), ids),
    edges: [...state.edges, ...copyEdges],
    selectedNodes: ids,
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

/** 主题 / 样式预设的应用范围 */
export type ThemeScope = 'all' | 'selection';

/**
 * 应用主题（样式预设）到整图或选中元素。
 * 只覆盖预设声明的字段，其余样式保持原样；整个操作合并为一次撤销。
 */
export function applyTheme(themeId: ThemeId, scope: ThemeScope): void {
  const theme = themeOf(themeId);
  if (!theme) return;
  const { nodes, edges, selectedNodes, selectedEdges } = useFlowStore.getState();
  const nodeIds = scope === 'selection' ? new Set(selectedNodes) : null;
  const edgeIds = scope === 'selection' ? new Set(selectedEdges) : null;
  if (scope === 'selection' && (nodeIds?.size ?? 0) === 0 && (edgeIds?.size ?? 0) === 0) return;

  useFlowStore.getState().commit();
  useFlowStore.setState({
    nodes: nodes.map((n) =>
      !nodeIds || nodeIds.has(n.id)
        ? { ...n, data: { ...n.data, style: { ...n.data.style, ...theme.node } } }
        : n,
    ),
    edges: edges.map((e) => {
      if (edgeIds && !edgeIds.has(e.id)) return e;
      const current = normalizeEdgeStyle(
        (e.data as { style?: Partial<FlowEdgeStyle> } | undefined)?.style,
      );
      const next = normalizeEdgeStyle({ ...current, ...theme.edge });
      return { ...e, data: { ...(e.data ?? {}), style: next }, ...edgePropsOf(next) };
    }),
  });
}

/** 格式刷：复制第一个选中节点的样式 */
export function copyNodeStyle(): boolean {
  const { nodes, selectedNodes } = useFlowStore.getState();
  const source = nodes.find((n) => n.id === selectedNodes[0]);
  if (!source) return false;
  useFlowStore.getState().setStyleBrush({ ...source.data.style });
  return true;
}

/** 格式刷：把已复制的样式套用到选中节点（一次撤销） */
export function pasteNodeStyle(): void {
  const brush = useFlowStore.getState().styleBrush;
  if (!brush) return;
  const { selectedNodes } = useFlowStore.getState();
  if (selectedNodes.length === 0) return;
  useFlowStore.getState().patchSelected({ style: { ...brush } }, true);
}

/** 单个节点的层级调整（图层面板的上下箭头） */
export function moveNodeLayer(id: string, op: LayerOp): void {
  const { nodes } = useFlowStore.getState();
  if (!nodes.some((n) => n.id === id)) return;
  const reordered = orderNodesByHierarchy(reorderLayers(nodes, new Set([id]), op));
  useFlowStore.getState().commit();
  useFlowStore.setState({ nodes: reordered });
}
