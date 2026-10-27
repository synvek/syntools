/**
 * Flowchart editor logic layer: no React Flow / DOM references, so it can be unit-tested and drafts serialized.
 * Convention: pure functions never throw to callers; validation helpers return a boolean or ToolResult.
 */

import {
  type Align,
  type EdgeLabelPosition,
  type EdgeRoutingMode,
  type FlowDoc,
  type FlowEdgeRec,
  type FlowEdgeStyle,
  type FlowNodeData,
  type FlowNodeRec,
  type FlowNodeStyle,
  type FlowNodeType,
  type ShapeKind,
  type ShapeSize,
  type Waypoint,
  isContainerKind,
  minNodeSize,
} from './model/types';
import { shapeDefOf, shapeSize } from './model/shapes';
import { migrateDoc, toDocV3 } from './model/migrate';
import { emptyTable } from './model/table';

let idCounter = 0;

/** Build a stable, unique node/edge id (no randomness, for testability) */
export function createId(prefix = 'n'): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

/** Normalize a #RRGGBB color; invalid input falls back to `fallback` */
export function normalizeColor(input: string | undefined | null, fallback = '#000000'): string {
  if (!input) return fallback;
  const text = input.trim().replace(/^#/, '');
  const full = /^[0-9a-fA-F]{3}$/.test(text)
    ? text
        .split('')
        .map((c) => c + c)
        .join('')
    : text;
  if (/^[0-9a-fA-F]{6}$/.test(full)) return `#${full.toLowerCase()}`;
  return fallback;
}

/* --------------------------- Node transform (rotation / mirror) --------------------------- */

/** Normalize any angle into [0, 360) */
export function normalizeRotation(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

/** Snap an angle to a multiple of `step` (normalizes to whole degrees when step <= 0) */
export function snapRotation(deg: number, step: number): number {
  const base = normalizeRotation(deg);
  if (!Number.isFinite(step) || step <= 0) return Math.round(base);
  return normalizeRotation(Math.round(base / step) * step);
}

/**
 * Angle (degrees, 0 = pointing right, increasing clockwise) from a center point and pointer position.
 * Shared by handle rendering and dragging so the geometry stays consistent.
 */
export function angleFromCenter(cx: number, cy: number, px: number, py: number): number {
  return normalizeRotation((Math.atan2(py - cy, px - cx) * 180) / Math.PI);
}

/**
 * CSS transform for a node transform (rotation + mirror).
 * Origin is the bounding-box center; returns undefined when there is no transform, avoiding needless compositing layers.
 */
export function nodeTransformCss(style: Partial<FlowNodeStyle> | undefined): string | undefined {
  const rotation = normalizeRotation(style?.rotation ?? 0);
  const sx = style?.flipH === true ? -1 : 1;
  const sy = style?.flipV === true ? -1 : 1;
  const parts: string[] = [];
  if (rotation !== 0) parts.push(`rotate(${round(rotation, 3)}deg)`);
  if (sx !== 1 || sy !== 1) parts.push(`scale(${sx}, ${sy})`);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/* --------------------------- Container resize linkage --------------------------- */

/** Result of converting child nodes after a container resize */
export interface ScaledChild {
  id: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
}

/**
 * Convert child relative coordinates and sizes proportionally when a container (swimlane / group) is resized.
 *
 * Child coordinates are relative to the container, so scaling by the ratio preserves the visual layout;
 * sizes are scaled by the same ratio and clamped to each child's minimum so shrinking never makes them invisible.
 * Returns an empty array when the size did not change or the ratio is invalid (callers skip the write).
 */
export function scaleChildren(
  children: ReadonlyArray<{
    id: string;
    kind: ShapeKind;
    position: { x: number; y: number };
    width?: number;
    height?: number;
  }>,
  prev: ShapeSize,
  next: ShapeSize,
): ScaledChild[] {
  if (children.length === 0) return [];
  if (prev.width <= 0 || prev.height <= 0 || next.width <= 0 || next.height <= 0) return [];
  const sx = next.width / prev.width;
  const sy = next.height / prev.height;
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return [];
  if (Math.abs(sx - 1) < 1e-6 && Math.abs(sy - 1) < 1e-6) return [];
  return children.map((child) => {
    const min = minNodeSize(child.kind);
    const base = shapeSize(child.kind);
    const width = child.width ?? base.width;
    const height = child.height ?? base.height;
    return {
      id: child.id,
      position: {
        x: Math.round(child.position.x * sx),
        y: Math.round(child.position.y * sy),
      },
      width: Math.max(min.width, Math.round(width * sx)),
      height: Math.max(min.height, Math.round(height * sy)),
    };
  });
}

/**
 * Hyperlink protocol allowlist: only http / https / mailto pass; anything else (including javascript:) is invalid.
 * Returns a string usable directly as href; undefined when invalid.
 */
export function safeLinkHref(link: string | undefined): string | undefined {
  if (!link) return undefined;
  const trimmed = link.trim();
  if (!trimmed) return undefined;
  // Prepend https when the input has no scheme, so users can type just a domain
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  return /^(https?|mailto):/i.test(withScheme) ? withScheme : undefined;
}

export const DEFAULT_STYLE: FlowNodeStyle = {
  fill: '#EFF6FF',
  stroke: '#2563EB',
  strokeWidth: 2,
  fontSize: 13,
  bold: false,
  italic: false,
  align: 'center',
};

/**
 * Base color scheme per shape (all palettes live in the shape catalog, so new shapes need no change here).
 * Default text is an empty string: a new shape carries no copy, avoiding placeholder text unrelated to the user.
 */
export function defaultData(kind: ShapeKind, label = ''): FlowNodeData {
  const base: FlowNodeStyle = { ...DEFAULT_STYLE };
  const def = shapeDefOf(kind);
  if (def?.defaultStyle) Object.assign(base, def.defaultStyle);
  if (isContainerKind(kind)) base.align = 'left';
  return { kind, label, style: base };
}

/** Icon node data (color comes from stroke, the rest of the drawing is decided by IconNode) */
export function iconData(iconId: string, label = ''): FlowNodeData {
  return {
    kind: 'rect',
    label,
    iconId,
    style: { ...DEFAULT_STYLE, fill: '#FFFFFF', stroke: '#0F172A', strokeWidth: 0, fontSize: 12 },
  };
}

/** Image node data (dataURL inlined directly, never leaves the browser) */
export function imageData(src: string, label = ''): FlowNodeData {
  return {
    kind: 'rect',
    label,
    src,
    style: { ...DEFAULT_STYLE, fill: '#FFFFFF', stroke: '#CBD5E1', strokeWidth: 1, fontSize: 12 },
  };
}

/** Formula node data (LaTeX source; KaTeX is loaded dynamically at render time) */
export function formulaData(formula: string, label = ''): FlowNodeData {
  return {
    kind: 'rect',
    label,
    formula,
    style: { ...DEFAULT_STYLE, fill: '#FFFFFF', stroke: '#0F172A', strokeWidth: 0, fontSize: 16 },
  };
}

/** Table node data (defaults to an empty 3×3 table rendered as an editable grid) */
export function tableData(rows = 3, cols = 3, label = ''): FlowNodeData {
  return {
    kind: 'rect',
    label,
    table: emptyTable(rows, cols),
    style: { ...DEFAULT_STYLE, fill: '#FFFFFF', stroke: '#334155', strokeWidth: 1, fontSize: 12 },
  };
}

/* --------------------------- Alignment guides --------------------------- */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HelperLines {
  /** Snapped x of the dragged node (undefined when not snapped) */
  x?: number;
  /** Snapped y */
  y?: number;
  /** Canvas x coordinate of the vertical guide */
  vertical?: number;
  /** Canvas y coordinate of the horizontal guide */
  horizontal?: number;
  /** Whether the vertical guide is a center alignment (used to distinguish styles) */
  verticalCenter?: boolean;
  /** Whether the horizontal guide is a center alignment */
  horizontalCenter?: boolean;
}

interface Bounds {
  left: number;
  right: number;
  centerX: number;
  top: number;
  bottom: number;
  centerY: number;
}

function toBounds(r: Rect): Bounds {
  return {
    left: r.x,
    right: r.x + r.width,
    centerX: r.x + r.width / 2,
    top: r.y,
    bottom: r.y + r.height,
    centerY: r.y + r.height / 2,
  };
}

/**
 * Compute the snap position and guide coordinates between the dragged node and the other nodes.
 * Compares the left/right/center axes and the top/bottom/middle axes, snapping when the gap is ≤ tolerance.
 */
export function computeHelperLines(dragging: Rect, others: Rect[], tolerance = 5): HelperLines {
  const db = toBounds(dragging);
  let minX = tolerance;
  let minY = tolerance;
  const result: HelperLines = {};

  for (const other of others) {
    const ob = toBounds(other);
    // [target coordinate, dragged-side coordinate, is center alignment]
    const xPairs: Array<[number, number, boolean]> = [
      [ob.left, db.left, false],
      [ob.right, db.left, false],
      [ob.centerX, db.left, false],
      [ob.left, db.right, false],
      [ob.right, db.right, false],
      [ob.centerX, db.right, false],
      [ob.left, db.centerX, true],
      [ob.right, db.centerX, true],
      [ob.centerX, db.centerX, true],
    ];
    for (const [target, moving, isCenter] of xPairs) {
      const dist = Math.abs(target - moving);
      if (dist < minX) {
        minX = dist;
        result.x = dragging.x + (target - moving);
        result.vertical = target;
        result.verticalCenter = isCenter;
      }
    }
    const yPairs: Array<[number, number, boolean]> = [
      [ob.top, db.top, false],
      [ob.bottom, db.top, false],
      [ob.centerY, db.top, false],
      [ob.top, db.bottom, false],
      [ob.bottom, db.bottom, false],
      [ob.centerY, db.bottom, false],
      [ob.top, db.centerY, true],
      [ob.bottom, db.centerY, true],
      [ob.centerY, db.centerY, true],
    ];
    for (const [target, moving, isCenter] of yPairs) {
      const dist = Math.abs(target - moving);
      if (dist < minY) {
        minY = dist;
        result.y = dragging.y + (target - moving);
        result.horizontal = target;
        result.horizontalCenter = isCenter;
      }
    }
  }
  return result;
}

/* --------------------------- Container (swimlane) hierarchy --------------------------- */

/** Minimal node shape needed for hierarchy computation */
export interface HierarchyNode {
  id: string;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
  parentId?: string | null;
  data: { kind: ShapeKind };
}

function nodeSize(node: HierarchyNode): ShapeSize {
  return {
    width: node.width ?? shapeSize(node.data.kind).width,
    height: node.height ?? shapeSize(node.data.kind).height,
  };
}

/** Compute a node's absolute position on the canvas (accumulating parent offsets) */
export function absolutePositionOf<T extends HierarchyNode>(
  node: T,
  byId: Map<string, T>,
): { x: number; y: number } {
  if (!node.parentId) return { x: node.position.x, y: node.position.y };
  const parent = byId.get(node.parentId);
  if (!parent) return { x: node.position.x, y: node.position.y };
  const base = absolutePositionOf(parent, byId);
  return { x: base.x + node.position.x, y: base.y + node.position.y };
}

/** Absolute bounding box of a node on the canvas */
export function absoluteRectOf<T extends HierarchyNode>(node: T, byId: Map<string, T>): Rect {
  const pos = absolutePositionOf(node, byId);
  const size = nodeSize(node);
  return { x: pos.x, y: pos.y, width: size.width, height: size.height };
}

/**
 * Memoized version of the absolute bounding box (performance optimization).
 *
 * Drag guides compute bounding boxes for many nodes per frame; unmoved node objects keep their identity,
 * as do their parent objects, so the previous frame's result can be reused.
 * The cache maps "node object → { parent object, bbox }": moving a parent produces a new parent object reference,
 * which invalidates the cache automatically, so child boxes never go stale after dragging a container.
 * A WeakMap lets the cache be collected with the node objects, requiring no manual cleanup.
 */
const rectCache = new WeakMap<object, { parent: object | null; rect: Rect }>();

export function cachedAbsoluteRectOf<T extends HierarchyNode>(node: T, byId: Map<string, T>): Rect {
  const parent = node.parentId ? (byId.get(node.parentId) ?? null) : null;
  const key = node as unknown as object;
  const hit = rectCache.get(key);
  if (hit && hit.parent === (parent as unknown as object | null)) return hit.rect;
  const rect = absoluteRectOf(node, byId);
  rectCache.set(key, { parent: parent as unknown as object | null, rect });
  return rect;
}

export interface Placement {
  /** Swimlane id when the point hits one; otherwise undefined (canvas top level) */
  parentId?: string;
  /** Relative coordinates when a swimlane is hit, absolute coordinates otherwise */
  position: { x: number; y: number };
}

/**
 * Check whether a drop point falls inside a swimlane:
 * if so return the swimlane id and relative coordinates, otherwise return the absolute coordinates unchanged.
 * When several swimlanes overlap, the smallest area wins.
 */
export function resolvePlacement(
  rect: Rect,
  lanes: ReadonlyArray<{ id: string; rect: Rect }>,
): Placement {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  let hit: { id: string; rect: Rect } | undefined;
  for (const lane of lanes) {
    const r = lane.rect;
    if (cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height) {
      if (!hit || r.width * r.height < hit.rect.width * hit.rect.height) hit = lane;
    }
  }
  if (!hit) return { position: { x: rect.x, y: rect.y } };
  return {
    parentId: hit.id,
    position: { x: rect.x - hit.rect.x, y: rect.y - hit.rect.y },
  };
}

/**
 * Order: swimlanes (containers) at the bottom → other top-level nodes → child nodes.
 * React Flow requires parents to appear before children in the array, and array order defines stacking.
 */
export function orderNodesByHierarchy<T extends HierarchyNode>(nodes: readonly T[]): T[] {
  const lanes: T[] = [];
  const tops: T[] = [];
  const children: T[] = [];
  for (const n of nodes) {
    if (n.parentId) children.push(n);
    else if (isContainerKind(n.data.kind)) lanes.push(n);
    else tops.push(n);
  }
  return [...lanes, ...tops, ...children];
}

export type AnchorSide = 't' | 'b' | 'l' | 'r';

/** Anchor id → relative position inside the shape (kept in sync with HANDLES in ShapeNode) */
const HANDLE_ANCHORS: Record<string, { fx: number; fy: number }> = {
  't-l': { fx: 0.25, fy: 0 },
  t: { fx: 0.5, fy: 0 },
  't-r': { fx: 0.75, fy: 0 },
  'b-l': { fx: 0.25, fy: 1 },
  b: { fx: 0.5, fy: 1 },
  'b-r': { fx: 0.75, fy: 1 },
  l: { fx: 0, fy: 0.5 },
  r: { fx: 1, fy: 0.5 },
};

/**
 * Position of an edge endpoint on the canvas and the side it sits on.
 * Without anchor info (imported data / free edges), takes the midpoint of the side facing the opposite end.
 */
export function anchorOf<T extends HierarchyNode>(
  node: T,
  byId: Map<string, T>,
  handleId?: string | null,
  other?: T,
): { point: { x: number; y: number }; side: AnchorSide } {
  const rect = absoluteRectOf(node, byId);
  const anchor = handleId ? HANDLE_ANCHORS[handleId] : undefined;
  if (anchor) {
    const side: AnchorSide =
      anchor.fy === 0 ? 't' : anchor.fy === 1 ? 'b' : anchor.fx === 0 ? 'l' : 'r';
    return {
      point: { x: rect.x + rect.width * anchor.fx, y: rect.y + rect.height * anchor.fy },
      side,
    };
  }
  const otherRect = other ? absoluteRectOf(other, byId) : rect;
  const dx = otherRect.x + otherRect.width / 2 - (rect.x + rect.width / 2);
  const dy = otherRect.y + otherRect.height / 2 - (rect.y + rect.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { point: { x: rect.x + rect.width, y: rect.y + rect.height / 2 }, side: 'r' }
      : { point: { x: rect.x, y: rect.y + rect.height / 2 }, side: 'l' };
  }
  return dy >= 0
    ? { point: { x: rect.x + rect.width / 2, y: rect.y + rect.height }, side: 'b' }
    : { point: { x: rect.x + rect.width / 2, y: rect.y }, side: 't' };
}

/** Extend a point outward along its side's normal (the short stub at each end of orthogonal routing) */
export function stubPoint(
  point: { x: number; y: number },
  side: AnchorSide,
  distance = 24,
): { x: number; y: number } {
  switch (side) {
    case 't':
      return { x: point.x, y: point.y - distance };
    case 'b':
      return { x: point.x, y: point.y + distance };
    case 'l':
      return { x: point.x - distance, y: point.y };
    default:
      return { x: point.x + distance, y: point.y };
  }
}

/* --------------------------- Serialization / validation --------------------------- */

export interface SerializeResult {
  ok: boolean;
  doc?: FlowDoc;
  error?: string;
}

/** Loose validation: anything that normalizes to v2 is valid (keeps legacy v1 documents readable) */
export function validateDoc(raw: unknown): raw is FlowDoc {
  return migrateDoc(raw) !== null;
}

/** Serialize internal state into a persistable v3 document (single-page records; the store assembles pages) */
export function serializeDoc(
  nodes: ReadonlyArray<{
    id: string;
    position: { x: number; y: number };
    parentId?: string | null;
    data: FlowNodeData;
    width?: number;
    height?: number;
    hidden?: boolean;
    locked?: boolean;
    /** Node type (absent is treated as a shape node, for legacy documents) */
    type?: FlowNodeType;
    mxStyle?: string[];
  }>,
  edges: ReadonlyArray<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    label?: string;
    sourceLabel?: string;
    targetLabel?: string;
    labelPosition?: EdgeLabelPosition;
    style?: FlowEdgeStyle;
    waypoints?: Waypoint[];
    routing?: EdgeRoutingMode;
    avoidObstacles?: boolean;
    mxStyle?: string[];
  }>,
  pageName?: string,
): FlowDoc {
  const recNodes: FlowNodeRec[] = nodes.map((n) => ({
    id: n.id,
    type: n.type ?? 'shape',
    position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    parentId: n.parentId ?? null,
    width: n.width,
    height: n.height,
    hidden: n.hidden === true,
    locked: n.locked === true,
    ...(n.mxStyle && n.mxStyle.length > 0 ? { mxStyle: [...n.mxStyle] } : {}),
    data: {
      kind: n.data.kind,
      label: n.data.label,
      style: { ...n.data.style },
      ...(n.data.collapsed ? { collapsed: true } : {}),
      ...(n.data.src ? { src: n.data.src } : {}),
      ...(n.data.iconId ? { iconId: n.data.iconId } : {}),
      ...(n.data.formula ? { formula: n.data.formula } : {}),
      ...(n.data.table ? { table: n.data.table } : {}),
    },
  }));
  const recEdges: FlowEdgeRec[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
    label: e.label,
    ...(e.sourceLabel ? { sourceLabel: e.sourceLabel } : {}),
    ...(e.targetLabel ? { targetLabel: e.targetLabel } : {}),
    ...(e.labelPosition ? { labelPosition: e.labelPosition } : {}),
    style: e.style ? { ...e.style } : undefined,
    ...(e.waypoints && e.waypoints.length > 0
      ? { waypoints: e.waypoints.map((p) => ({ x: p.x, y: p.y })) }
      : {}),
    ...(e.routing ? { routing: e.routing } : {}),
    ...(e.avoidObstacles ? { avoidObstacles: true } : {}),
    ...(e.mxStyle && e.mxStyle.length > 0 ? { mxStyle: [...e.mxStyle] } : {}),
  }));
  return toDocV3(recNodes, recEdges, pageName);
}

/** Deserialize and normalize to v2; returns { ok:false } when invalid so callers can fall back to an empty graph */
export function deserializeDoc(raw: unknown): SerializeResult {
  const doc = migrateDoc(raw);
  if (!doc) return { ok: false, error: 'INVALID_DOC' };
  return { ok: true, doc };
}

/* Templates moved to `./model/templates` (a template library grouped by diagram type) */

/** Exposed for tests only: resets the internal counter */
export function __resetIdCounter(): void {
  idCounter = 0;
}

export type { Align };
