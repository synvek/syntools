import Konva from 'konva';
import { resolvePresetGeometry } from '../../../core/drawing/shapeDefs';
import { lineGeometryFromPoints, lineEndpoint, nearestConnectorSite } from '../model/connectors';
import {
  commandsFromGeometry,
  commandsToSvg,
  movePathAnchor,
  movePathControl,
  pathNodes,
  scaleCommands,
  type PathNodeView,
  type PathPoint,
} from '../../../core/drawing/custGeom';
import { shapeAdjustValues, shapeAdjustments } from '../../../core/drawing/shapeDefs';
import type {
  ConnectorEnd,
  LineElement,
  PathCommand,
  ShapeElement,
  SlideElement,
} from '../model/types';
import { reshapeShapeNode } from './nodes';

/**
 * PowerPoint-style yellow adjustment handles plus connector endpoint handles.
 *
 * Handles live in the content layer (page coordinates), are rebuilt whenever the selection
 * changes, and mutate the Konva node live during a drag; the store only receives the final
 * value on dragend so a drag produces exactly one undo step.
 *
 * The same module draws the node-editing handles of custom-geometry shapes (P1-1.4): white
 * anchors (circles = smooth, squares = corner), blue bezier controls and dashed links.
 */
export interface AdjustHandleCallbacks {
  onShapeAdjust: (id: string, adj: Record<string, number>) => void;
  onConnectorEnd: (
    id: string,
    which: 'start' | 'end',
    end: ConnectorEnd | null,
    geometry: Partial<LineElement>,
  ) => void;
  /** Node editing: drag of an anchor / control committed the final normalized commands */
  onPathCommands: (id: string, commands: PathCommand[]) => void;
  /** Node editing: an anchor was activated (null clears the focus) */
  onPathActive: (index: number | null) => void;
  /** Node editing: double-click toggled the anchor between smooth and corner */
  onPathToggleSmooth: (id: string, index: number) => void;
}

export interface AdjustHandleOptions {
  /** Custom-geometry shape currently in node-editing mode */
  pathEditId?: string | null;
  /** Focused anchor inside that shape */
  activePathNode?: number | null;
}

const HANDLE_NAME = 'adjustHandle';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clearAdjustHandles(layer: Konva.Layer): void {
  for (const node of layer.find(`.${HANDLE_NAME}`)) node.destroy();
}

export function renderAdjustHandles(
  layer: Konva.Layer,
  elements: SlideElement[],
  ids: string[],
  callbacks: AdjustHandleCallbacks,
  options: AdjustHandleOptions = {},
): void {
  clearAdjustHandles(layer);
  const selected = new Set(ids);
  if (selected.size === 0) {
    layer.batchDraw();
    return;
  }
  const scale = Math.max(0.2, layer.scaleX());
  const radius = 5 / scale;

  for (const element of elements) {
    if (!selected.has(element.id)) continue;
    // While editing nodes the shape shows anchors instead of preset adjustment handles
    if (element.id === options.pathEditId && element.type === 'shape') {
      drawPathHandles(layer, element, options.activePathNode ?? null, radius, scale, callbacks);
      continue;
    }
    if (element.type === 'shape') {
      drawShapeHandles(layer, element, radius, scale, callbacks);
    } else if (element.type === 'line') {
      drawLineHandles(layer, element, elements, radius, scale, callbacks);
    }
  }
  layer.batchDraw();
}

function handleCircle(
  x: number,
  y: number,
  radius: number,
  color: string,
  scale: number,
): Konva.Circle {
  return new Konva.Circle({
    x,
    y,
    radius,
    fill: color,
    stroke: '#7C4A00',
    strokeWidth: 1 / scale,
    draggable: true,
    name: HANDLE_NAME,
    hitStrokeWidth: 10,
  });
}

function drawShapeHandles(
  layer: Konva.Layer,
  element: Extract<SlideElement, { type: 'shape' }>,
  radius: number,
  scale: number,
  callbacks: AdjustHandleCallbacks,
): void {
  const values = shapeAdjustValues(element.geom);
  const group = layer.findOne<Konva.Group>(`#${element.id}`);
  const shapeNode = group?.findOne<Konva.Shape>('.shapeBody');

  for (const spec of shapeAdjustments(element.geom.prst)) {
    const current = values[spec.id];
    const at = spec.at(current);
    const circle = handleCircle(
      element.x + at.x * element.width,
      element.y + at.y * element.height,
      radius,
      '#FFC000',
      scale,
    );
    circle.setAttr('adjValue', current);

    circle.on('dragmove', () => {
      const point = circle.position();
      const normalized = {
        x: (point.x - element.x) / Math.max(1, element.width),
        y: (point.y - element.y) / Math.max(1, element.height),
      };
      const value = clamp(spec.from(normalized), spec.min, spec.max);
      const next = { ...values, [spec.id]: value };
      const snapped = spec.at(value);
      circle.position({
        x: element.x + snapped.x * element.width,
        y: element.y + snapped.y * element.height,
      });
      circle.setAttr('adjValue', value);
      if (shapeNode) {
        reshapeShapeNode(shapeNode, element, resolvePresetGeometry(element.geom.prst, next));
        layer.batchDraw();
      }
    });

    circle.on('dragend', () => {
      callbacks.onShapeAdjust(element.id, { [spec.id]: circle.getAttr('adjValue') });
    });

    layer.add(circle);
  }
}

function drawLineHandles(
  layer: Konva.Layer,
  element: LineElement,
  elements: SlideElement[],
  radius: number,
  scale: number,
  callbacks: AdjustHandleCallbacks,
): void {
  const start = lineEndpoint(element, 'start');
  const end = lineEndpoint(element, 'end');
  const group = layer.findOne<Konva.Group>(`#${element.id}`);
  const lineNode = group?.findOne<Konva.Line>('.lineBody');

  (['start', 'end'] as const).forEach((which) => {
    const fixed = which === 'start' ? end : start;
    const initial = which === 'start' ? start : end;
    const circle = handleCircle(initial.x, initial.y, radius, '#38BDF8', scale);
    circle.setAttr('connectorEnd', which);
    let last = lineGeometryFromPoints(start, end, element.route);

    circle.on('dragmove', () => {
      const point = circle.position();
      const hit = nearestConnectorSite(elements, point, element.id, 18 / scale);
      circle.fill(hit ? '#22C55E' : '#38BDF8');
      const startPoint = which === 'start' ? (hit ? { x: hit.x, y: hit.y } : point) : fixed;
      const endPoint = which === 'end' ? (hit ? { x: hit.x, y: hit.y } : point) : fixed;
      last = lineGeometryFromPoints(startPoint, endPoint, element.route);
      if (group) group.position({ x: last.x, y: last.y });
      lineNode?.points(last.points);
      layer.batchDraw();
    });

    circle.on('dragend', () => {
      const point = circle.position();
      const hit = nearestConnectorSite(elements, point, element.id, 18 / scale);
      if (hit) {
        callbacks.onConnectorEnd(element.id, which, { shapeId: hit.shapeId, site: hit.site }, {});
      } else {
        callbacks.onConnectorEnd(element.id, which, null, last);
      }
    });

    layer.add(circle);
  });
}

const PATH_ANCHOR_FILL = '#FFFFFF';
const PATH_ACTIVE_FILL = '#FFC000';
const PATH_STROKE = '#2563EB';
const PATH_CONTROL_FILL = '#2563EB';

/**
 * Node-editing handles for a custom-geometry shape.
 *
 * Anchors are white squares (corner) or circles (smooth); bezier controls are small blue dots
 * joined to their anchor by a dashed line. Positions go through the element's own transform, so
 * rotated / flipped shapes get handles in the right place; drags are converted back through the
 * inverse transform before touching the normalized commands.
 */
function drawPathHandles(
  layer: Konva.Layer,
  element: ShapeElement,
  activeIndex: number | null,
  radius: number,
  scale: number,
  callbacks: AdjustHandleCallbacks,
): void {
  const group = layer.findOne<Konva.Group>(`#${element.id}`);
  // Custom geometry always renders as Konva.Path (see createShapeNode)
  const body = group?.findOne<Konva.Path>('.shapeBody');
  if (!group || !body) return;
  let commands = commandsFromGeometry(element.geom);
  if (commands.length < 2) return;

  const width = Math.max(1, element.width);
  const height = Math.max(1, element.height);
  const toLayer = (point: PathPoint): PathPoint => {
    const value = group.getTransform().point({ x: point.x * width, y: point.y * height });
    return { x: value.x, y: value.y };
  };
  const toNormalized = (point: PathPoint): PathPoint => {
    const inverse = group.getTransform().copy();
    inverse.invert();
    const local = inverse.point(point);
    return { x: local.x / width, y: local.y / height };
  };

  const anchors: { index: number; node: Konva.Shape }[] = [];
  const controls: { index: number; which: 'in' | 'out'; node: Konva.Circle; link: Konva.Line }[] =
    [];

  /** Re-lay every handle from the current commands (no nodes are created or destroyed) */
  const update = (): void => {
    const views = new Map(pathNodes(commands).map((view) => [view.index, view]));
    body.data(commandsToSvg(scaleCommands(commands, width, height)));
    for (const anchor of anchors) {
      const view = views.get(anchor.index);
      if (view) anchor.node.position(toLayer(view));
    }
    for (const control of controls) {
      const view = views.get(control.index);
      const point = control.which === 'in' ? view?.in : view?.out;
      if (!view || !point) {
        control.node.visible(false);
        control.link.visible(false);
        continue;
      }
      const anchorPoint = toLayer(view);
      const position = toLayer(point);
      control.node.visible(true);
      control.link.visible(true);
      control.node.position(position);
      control.link.points([anchorPoint.x, anchorPoint.y, position.x, position.y]);
    }
    layer.batchDraw();
  };

  const handle = (view: PathNodeView): Konva.Shape => {
    const position = toLayer(view);
    const fill = view.index === activeIndex ? PATH_ACTIVE_FILL : PATH_ANCHOR_FILL;
    const node = view.smooth
      ? new Konva.Circle({
          x: position.x,
          y: position.y,
          radius,
          fill,
          stroke: PATH_STROKE,
          strokeWidth: 1.5 / scale,
          name: HANDLE_NAME,
          draggable: true,
          hitStrokeWidth: 10,
        })
      : new Konva.Rect({
          x: position.x,
          y: position.y,
          width: radius * 2,
          height: radius * 2,
          offsetX: radius,
          offsetY: radius,
          fill,
          stroke: PATH_STROKE,
          strokeWidth: 1.5 / scale,
          name: HANDLE_NAME,
          draggable: true,
          hitStrokeWidth: 10,
        });
    node.setAttr('pathAnchorIndex', view.index);

    node.on('dragmove', () => {
      const point = toNormalized(node.position());
      commands = movePathAnchor(commands, view.index, point.x, point.y);
      update();
    });
    node.on('dragend', () => callbacks.onPathCommands(element.id, commands));
    // Selecting an anchor is what makes Delete meaningful; double-click flips smooth/corner
    node.on('click tap', () => callbacks.onPathActive(view.index));
    node.on('dblclick dbltap', () => callbacks.onPathToggleSmooth(element.id, view.index));
    return node;
  };

  for (const view of pathNodes(commands)) {
    const node = handle(view);
    anchors.push({ index: view.index, node });
    layer.add(node);
  }

  for (const view of pathNodes(commands)) {
    for (const which of ['in', 'out'] as const) {
      const point = which === 'in' ? view.in : view.out;
      if (!point) continue;
      const anchorPoint = toLayer(view);
      const position = toLayer(point);
      const link = new Konva.Line({
        points: [anchorPoint.x, anchorPoint.y, position.x, position.y],
        stroke: PATH_STROKE,
        strokeWidth: 1 / scale,
        dash: [4 / scale, 3 / scale],
        listening: false,
        name: HANDLE_NAME,
      });
      const node = new Konva.Circle({
        x: position.x,
        y: position.y,
        radius: radius * 0.7,
        fill: PATH_CONTROL_FILL,
        stroke: '#FFFFFF',
        strokeWidth: 1 / scale,
        name: HANDLE_NAME,
        draggable: true,
        hitStrokeWidth: 8,
      });
      node.on('dragmove', () => {
        const next = toNormalized(node.position());
        commands = movePathControl(commands, view.index, which, next.x, next.y);
        update();
      });
      node.on('dragend', () => callbacks.onPathCommands(element.id, commands));
      controls.push({ index: view.index, which, node, link });
      layer.add(link);
      layer.add(node);
    }
  }
}
