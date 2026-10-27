/**
 * Composite editing operations (align, distribute, layering, grouping, clipboard, edge styles).
 * Driven through the store's setState/getState, keeping a single store file from piling up too much logic.
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

/** Selected non-container nodes, returning their absolute canvas bounding boxes (containers do not take part in layout) */
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

/** Write displacement results in absolute coordinates back to nodes (converted to relative coordinates when a parent exists) */
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

/** Alignment reference frame: selection / whole canvas / page paper */
export type ArrangeScope = 'selection' | 'canvas' | 'page';

/** Distribution mode: equal spacing with both ends fixed / first and last flush with the reference rect edges */
export type DistributeMode = 'spacing' | 'edges';

/** Canvas reference rect: the overall bounding box of all visible nodes */
function canvasRect(): AlignRect | null {
  const { nodes } = useFlowStore.getState();
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const boxes: LayoutBox[] = nodes
    .filter((n) => n.hidden !== true)
    .map((n) => ({ id: n.id, ...absoluteRectOf(n, byId) }));
  return groupBounds(boxes);
}

/** Page reference rect: the paper size (returns null when no page size is set) */
function pageRect(): AlignRect | null {
  const size = useFlowStore.getState().pageSize;
  return size ? { x: 0, y: 0, width: size.width, height: size.height } : null;
}

/** Align selected nodes within the reference frame */
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

/** Distribute selected nodes within the reference frame (equal spacing or flush to both ends) */
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
 * Alignment add-on: snap the selected nodes' positions to the canvas grid.
 * Positions are rounded to the grid and written back (children inside containers convert back to relative coordinates);
 * no history entry is produced when grid snapping is off or everything is already aligned.
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
 * Uniform size: make the selected plain nodes take the width/height of "the first selected node".
 * Containers are excluded (their size follows content); at least two resizable nodes are needed; no history when already uniform.
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

/** Renormalize the order after a layer change so containers still precede their children */
export function layerOp(op: LayerOp): void {
  const { nodes, selectedNodes } = useFlowStore.getState();
  if (selectedNodes.length === 0) return;
  const selected = new Set(selectedNodes);
  const reordered = orderNodesByHierarchy(reorderLayers(nodes, selected, op));
  useFlowStore.getState().commit();
  useFlowStore.setState({ nodes: reordered });
}

/**
 * Rotate the selected nodes (degrees, added to each node's current angle; containers take part too).
 * Clears the field when it normalizes to 0, avoiding a redundant `rotation: 0` in the document.
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
 * Horizontal / vertical mirror.
 * Toggle semantics match "lock / hide": if any selected node is not mirrored, mirror them all; otherwise unmirror them all.
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

/** Wrap the selected plain nodes into a new group container */
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
  const padTop = 46; // group title bar + spacing
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

/** Ungroup the selected group: children return to absolute coordinates and are kept */
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
 * Cut: copy the selected nodes to the clipboard, then delete them.
 * With only edges selected (no nodes) it degrades to deleting the edges (edges cannot be pasted without nodes).
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

/** Change the style of the selected edges (missing fields are filled from the defaults) */
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

/** Style of the currently selected edges (for the property panel to display) */
export function selectedEdgeStyle(): FlowEdgeStyle {
  const { edges, selectedEdges } = useFlowStore.getState();
  const first = edges.find((e) => e.id === selectedEdges[0]);
  return normalizeEdgeStyle((first?.data as { style?: Partial<FlowEdgeStyle> } | undefined)?.style);
}

/** Toggle visibility: hidden if any is visible, otherwise all shown */
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

/** Toggle lock: locked nodes cannot be dragged or selected */
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

/** Rename a node (triggered by double-clicking the layer name) */
export function renameNode(id: string, name: string): void {
  const nodes = useFlowStore.getState().nodes;
  const node = nodes.find((n) => n.id === id);
  if (!node || node.data.label === name) return;
  useFlowStore.getState().commit();
  useFlowStore.setState({
    nodes: nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: name } } : n)),
  });
}

/** Scope to which a theme / style preset is applied */
export type ThemeScope = 'all' | 'selection';

/**
 * Apply a theme (style preset) to the whole diagram or the selection.
 * Only the fields the preset declares are overridden, other styles stay as they are; the whole operation is one undo step.
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

/** Format painter: copy the first selected node's style */
export function copyNodeStyle(): boolean {
  const { nodes, selectedNodes } = useFlowStore.getState();
  const source = nodes.find((n) => n.id === selectedNodes[0]);
  if (!source) return false;
  useFlowStore.getState().setStyleBrush({ ...source.data.style });
  return true;
}

/** Format painter: apply the copied style to the selected nodes (one undo step) */
export function pasteNodeStyle(): void {
  const brush = useFlowStore.getState().styleBrush;
  if (!brush) return;
  const { selectedNodes } = useFlowStore.getState();
  if (selectedNodes.length === 0) return;
  useFlowStore.getState().patchSelected({ style: { ...brush } }, true);
}

/** Layer change for a single node (the up/down arrows in the layer panel) */
export function moveNodeLayer(id: string, op: LayerOp): void {
  const { nodes } = useFlowStore.getState();
  if (!nodes.some((n) => n.id === id)) return;
  const reordered = orderNodesByHierarchy(reorderLayers(nodes, new Set([id]), op));
  useFlowStore.getState().commit();
  useFlowStore.setState({ nodes: reordered });
}
