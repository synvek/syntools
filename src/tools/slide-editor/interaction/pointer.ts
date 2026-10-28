import Konva from 'konva';
import { computeSnap, type Guide, type SnapCandidate } from '../core';
import { CONNECTOR_SITES, lineGeometryFromPoints } from '../model/connectors';
import type { LineElement, PathCommand } from '../model/types';
import type { StageHandle } from '../render/stage';
import { updateMarquee, type TransformChange } from '../render/overlays';

/**
 * Canvas interaction: selection / dragging (with snapping) / marquee / double-click to edit text.
 * This module only translates Konva events into callbacks; state changes belong to the store and the page component,
 * which keeps snapping, multi-select dragging and friends easy to extract into pure functions and test on their own.
 */

export type { TransformChange };

export interface SnapContext {
  page: { width: number; height: number };
  others: SnapCandidate[];
  /** Snap positions from manual guides */
  extraX: number[];
  extraY: number[];
  /** Grid snap step (0 = off) */
  grid: number;
}

export interface StageCallbacks {
  onSelect: (ids: string[], additive: boolean) => void;
  onDragStart: () => void;
  onDragMove: (id: string, x: number, y: number, guides: Guide[]) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd: (changes: TransformChange[]) => void;
  onBackgroundClick: () => void;
  onTextEdit: (id: string) => void;
  /**
   * Right click: `x` / `y` are viewport coordinates (clientX / clientY), `elementId` is the hit element;
   * null when nothing was hit (blank area / page rect / locked element), so the caller can show a canvas-level menu.
   */
  onContextMenu: (payload: { x: number; y: number; elementId: string | null }) => void;
  /** Report cell coordinates when a table cell is clicked (null when the click wasn't on a cell) */
  onCellSelect: (cell: { row: number; col: number } | null) => void;
  /** Pan the canvas (middle-button drag) */
  onPan: (dx: number, dy: number) => void;
  /** Adjustment handle committed (one undo step per drag) */
  onShapeAdjust: (id: string, adj: Record<string, number>) => void;
  /** Connector endpoint committed: `end` non-null binds to a site, null detaches with free geometry */
  onConnectorEnd: (
    id: string,
    which: 'start' | 'end',
    end: { shapeId?: string; site?: number } | null,
    geometry: Partial<LineElement>,
  ) => void;
  getSnapContext: () => SnapContext;
  getSelection: () => string[];
  /** Pen tool: clicks place path points instead of selecting / marquee-selecting */
  isPenMode?: () => boolean;
  /** Pen: a click placed one point (page coordinates) */
  onPenPoint?: (x: number, y: number) => void;
  /** Pen: double-click closed the path */
  onPenFinish?: () => void;

  /** Node editing: final normalized commands after an anchor / control drag */
  onPathCommands: (id: string, commands: PathCommand[]) => void;
  /** Node editing: an anchor was clicked (null clears the focus) */
  onPathActive: (index: number | null) => void;
  /** Node editing: double-click toggled smooth ↔ corner */
  onPathToggleSmooth: (id: string, index: number) => void;

  /** Group editing: double-click on a group opened it for child selection */
  onEnterGroup: (id: string) => void;
  /** Ids that may be selected at the current editing level (marquee filter) */
  getEditableIds?: () => string[];

  /** Comment marker clicked on the canvas (P1-2) */
  onSelectComment: (threadId: string) => void;
}

const SNAP_TOLERANCE = 6;

function ancestorElement(node: Konva.Node): Konva.Node | undefined {
  return node.findAncestor('.element', true) ?? undefined;
}

export function attachInteraction(handle: StageHandle): void {
  const { stage, contentLayer, marquee, callbacks } = handle;
  let marqueeStart: { x: number; y: number } | null = null;
  /** Middle-button drag panning: mutually exclusive with the marquee, and takes priority on press */
  let panStart: { x: number; y: number } | null = null;
  /** Whether this frame ended with a marquee; suppresses the stray background click that clears the selection */
  let marqueeJustEnded = false;
  let dragOrigin = new Map<string, { x: number; y: number }>();

  const pointerPosition = (): { x: number; y: number } => {
    const point = stage.getPointerPosition();
    return point ?? { x: 0, y: 0 };
  };

  stage.on('mousedown touchstart', (event) => {
    const target = event.target;
    // Middle button starts panning even over an element; the browser's default middle-click autoscroll is blocked here
    if (event.evt instanceof MouseEvent && event.evt.button === 1) {
      event.evt.preventDefault();
      panStart = pointerPosition();
      return;
    }
    // The right button is handled by contextmenu (menu), not by the marquee
    if (event.evt instanceof MouseEvent && event.evt.button === 2) return;
    // Pen mode takes over the left button: every press appends a path point, never a selection
    if (callbacks.isPenMode?.()) {
      const view = pointerPosition();
      const scale = contentLayer.scaleX() || 1;
      callbacks.onPenPoint?.(
        (view.x - contentLayer.x()) / scale,
        (view.y - contentLayer.y()) / scale,
      );
      return;
    }
    const element = ancestorElement(target);
    // Any press invalidates the previous "marquee ended" flag so it can't swallow later normal clicks
    marqueeJustEnded = false;
    if (element) return;
    // Press on the page rect or blank space → start a marquee
    marqueeStart = pointerPosition();
    updateMarquee(marquee, { x: marqueeStart.x, y: marqueeStart.y, width: 0, height: 0 });
  });

  stage.on('mousemove touchmove', () => {
    if (panStart) {
      const current = pointerPosition();
      callbacks.onPan(current.x - panStart.x, current.y - panStart.y);
      panStart = current;
      return;
    }
    if (!marqueeStart) return;
    const current = pointerPosition();
    updateMarquee(marquee, {
      x: Math.min(marqueeStart.x, current.x),
      y: Math.min(marqueeStart.y, current.y),
      width: Math.abs(current.x - marqueeStart.x),
      height: Math.abs(current.y - marqueeStart.y),
    });
  });

  stage.on('mouseup touchend', () => {
    if (panStart) {
      panStart = null;
      return;
    }
    if (!marqueeStart) return;
    const box = marquee.getAttrs();
    marqueeStart = null;
    updateMarquee(marquee, null);
    if (!box.visible || Number(box.width) < 4 || Number(box.height) < 4) return;
    const rect = {
      x: Number(box.x),
      y: Number(box.y),
      width: Number(box.width),
      height: Number(box.height),
    };
    // Deep: inside an entered group the marquee must catch its children, not only top-level elements
    const editable = callbacks.getEditableIds?.();
    const ids = contentLayer
      .find('.element')
      // Locked elements don't take part in the marquee
      .filter(
        (child) =>
          !child.getAttr('elLocked') &&
          intersects(child, rect) &&
          (!editable || editable.includes(child.id())),
      )
      .map((child) => child.id());
    // Mark this as a marquee landing so the following background click doesn't clear what was just selected
    marqueeJustEnded = true;
    callbacks.onSelect(ids, false);
  });

  stage.on('click tap', (event) => {
    // Konva still emits a background click after a marquee lands; swallow it to keep the selection
    if (marqueeJustEnded) {
      marqueeJustEnded = false;
      return;
    }
    // Only clicks inside contentLayer (elements / Transformer handles) matter; everything else is background
    if (event.target.getLayer() !== contentLayer) {
      callbacks.onBackgroundClick();
      return;
    }
    const element = ancestorElement(event.target);
    if (!element) return; // Transformer handles etc.: do nothing and don't clear the selection
    if (element.getAttr('elLocked')) return; // Locked elements can't be selected
    const additive = Boolean(
      event.evt instanceof MouseEvent && (event.evt.shiftKey || event.evt.metaKey),
    );
    callbacks.onSelect([element.id()], additive);
    // Record the coordinates when a table cell is clicked, so the property panel can edit that cell's text
    const row = event.target.getAttr('cellRow');
    const col = event.target.getAttr('cellCol');
    callbacks.onCellSelect(
      typeof row === 'number' && typeof col === 'number' ? { row, col } : null,
    );
  });

  stage.on('contextmenu', (event) => {
    const evt = event.evt;
    if (!(evt instanceof MouseEvent)) return;
    // Take over the browser menu: right clicks on the canvas always use our own menu
    evt.preventDefault();
    const element = ancestorElement(event.target);
    // Hits on contentLayer outside an element (Transformer handles, guides) keep the current selection;
    // otherwise right-clicking the object you just selected would show a "canvas menu", which is surprising
    const id =
      element?.id() ??
      (element === undefined && event.target.getLayer() === contentLayer
        ? callbacks.getSelection()[0]
        : undefined);
    // Same as the left button: locked elements can't be selected, so only the canvas-level menu applies
    if (!id || element?.getAttr('elLocked')) {
      callbacks.onContextMenu({ x: evt.clientX, y: evt.clientY, elementId: null });
      return;
    }
    // Right-clicking an unselected object selects it first (like PowerPoint) so menu actions target the right element
    if (!callbacks.getSelection().includes(id)) callbacks.onSelect([id], false);
    callbacks.onContextMenu({ x: evt.clientX, y: evt.clientY, elementId: id });
  });

  contentLayer.on('dblclick dbltap', (event) => {
    // In pen mode a double-click closes the path, it must not open the text editor
    if (callbacks.isPenMode?.()) return;
    const element = ancestorElement(event.target);
    if (!element) return;
    // Double-click on a group enters it (PowerPoint "edit group"); nested groups can be entered again
    if (element.getAttr('elType') === 'group') {
      callbacks.onEnterGroup(element.id());
      return;
    }
    callbacks.onTextEdit(element.id());
  });

  // The final double-click may land on blank space: the stage sees it even when the layer doesn't
  stage.on('dblclick dbltap', () => {
    if (callbacks.isPenMode?.()) callbacks.onPenFinish?.();
  });

  contentLayer.on('dragstart', (event) => {
    const node = event.target;
    if (!node.id()) return;
    dragOrigin = new Map();
    // Dragging an object that isn't selected: make it the sole selection first, then drag it alone,
    // instead of reusing the old selection and moving several objects together (the old selection stays selected, see below).
    let selection = callbacks.getSelection();
    if (!selection.includes(node.id())) {
      callbacks.onSelect([node.id()], false);
      selection = [node.id()];
    }
    const selected = new Set(selection);
    const parent = node.getParent();
    // Deep search: inside an entered group the members live under the group node, not the layer
    for (const child of contentLayer.find('.element')) {
      if (child.getParent() !== parent) continue;
      if (!selected.has(child.id())) continue;
      dragOrigin.set(child.id(), { x: child.x(), y: child.y() });
    }
    callbacks.onDragStart();
  });

  contentLayer.on('dragmove', (event) => {
    const node = event.target;
    if (!node.id()) return;
    const context = callbacks.getSnapContext();
    // Group children live in group-local coordinates: page snapping would move them to the wrong place
    const nested = node.getParent() !== contentLayer;
    const moving = nested
      ? { x: node.x(), y: node.y(), guides: [] as Guide[] }
      : snapNode(node, context, handle);
    if (nested) handle.hideGuides();
    const origin = dragOrigin.get(node.id());
    const dx = origin ? moving.x - origin.x : 0;
    const dy = origin ? moving.y - origin.y : 0;
    for (const [id, start] of dragOrigin) {
      if (id === node.id()) continue;
      const sibling = contentLayer.findOne<Konva.Node>(`#${id}`);
      if (sibling) sibling.position({ x: start.x + dx, y: start.y + dy });
    }
    updateBoundConnectors(contentLayer, node.id());
    contentLayer.batchDraw();
    callbacks.onDragMove(node.id(), moving.x, moving.y, moving.guides);
  });

  contentLayer.on('dragend', (event) => {
    const node = event.target;
    const id = node.id();
    if (id) callbacks.onDragEnd(id, Math.round(node.x()), Math.round(node.y()));
    handle.hideGuides();
    dragOrigin = new Map();
    contentLayer.batchDraw();
  });
}

/**
 * Bound connectors follow a dragged shape without waiting for dragend (the store sync is
 * suppressed while dragging so the dragged node isn't rebuilt). Only the line body moves;
 * arrow heads are rebuilt from the store on dragend.
 */
function updateBoundConnectors(layer: Konva.Layer, skipId: string): void {
  for (const node of layer.find('.element')) {
    if (node.id() === skipId) continue;
    // Nested connectors use group-local coordinates; the store rebuilds them on dragend anyway
    if (node.getParent() !== layer) continue;
    if (node.getAttr('elType') !== 'line') continue;
    const startId = node.getAttr('cxnStartId') as string | undefined;
    const endId = node.getAttr('cxnEndId') as string | undefined;
    if (!startId && !endId) continue;
    const lineNode = (node as Konva.Group).findOne<Konva.Line>('.lineBody');
    if (!lineNode) continue;
    const points = lineNode.points();
    const freeStart = { x: node.x() + (points[0] ?? 0), y: node.y() + (points[1] ?? 0) };
    const freeEnd = {
      x: node.x() + (points[points.length - 2] ?? node.width()),
      y: node.y() + (points[points.length - 1] ?? node.height()),
    };
    const startShape = startId ? layer.findOne<Konva.Node>(`#${startId}`) : undefined;
    const endShape = endId ? layer.findOne<Konva.Node>(`#${endId}`) : undefined;
    const start = startShape
      ? shapeSitePoint(startShape, Number(node.getAttr('cxnStartSite') ?? 0))
      : freeStart;
    const end = endShape
      ? shapeSitePoint(endShape, Number(node.getAttr('cxnEndSite') ?? 4))
      : freeEnd;
    const geometry = lineGeometryFromPoints(
      start,
      end,
      (node.getAttr('cxnRoute') as LineElement['route']) ?? 'straight',
    );
    node.position({ x: geometry.x, y: geometry.y });
    lineNode.points(geometry.points);
  }
}

function shapeSitePoint(shape: Konva.Node, site: number): { x: number; y: number } {
  const index = ((site % CONNECTOR_SITES.length) + CONNECTOR_SITES.length) % CONNECTOR_SITES.length;
  const normalized = CONNECTOR_SITES[index];
  return {
    x: shape.x() + normalized.x * (shape.width() ?? 0),
    y: shape.y() + normalized.y * (shape.height() ?? 0),
  };
}

/** Snapping during a drag: rewrite the node position directly so the screen locks on instantly */
function snapNode(
  node: Konva.Node,
  context: SnapContext,
  handle: StageHandle,
): { x: number; y: number; guides: Guide[] } {
  const box = node.getClientRect({ relativeTo: node.getLayer() ?? undefined });
  const scale = Math.max(0.1, handle.contentLayer.scaleX());
  const tolerance = SNAP_TOLERANCE / scale;
  const result = computeSnap(
    {
      x: node.x(),
      y: node.y(),
      width: node.width() || box.width,
      height: node.height() || box.height,
    },
    context.others,
    context.page,
    tolerance,
    { extraX: context.extraX, extraY: context.extraY, grid: context.grid },
  );
  node.position({ x: result.x, y: result.y });
  if (result.guides.length > 0) {
    handle.showGuides(result.guides, context.page);
  } else {
    handle.hideGuides();
  }
  return { x: result.x, y: result.y, guides: result.guides };
}

function intersects(
  node: Konva.Node,
  box: { x: number; y: number; width: number; height: number },
): boolean {
  const rect = node.getClientRect();
  return !(
    rect.x + rect.width < box.x ||
    rect.x > box.x + box.width ||
    rect.y + rect.height < box.y ||
    rect.y > box.y + box.height
  );
}
