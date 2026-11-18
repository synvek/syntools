/**
 * Overlay object factories and small pure helpers.
 *
 * Every factory clamps its input (`clampObject`) so the model can never hold an object outside the
 * page. Everything here is pure and side-effect free except `createObjectId`, which reads
 * `crypto.randomUUID` when the platform has it.
 */

import { clampNormRect } from './coords';
import type {
  NormRect,
  PdfImageObject,
  PdfInkObject,
  PdfMarkupObject,
  PdfNoteObject,
  PdfObject,
  PdfShapeObject,
  PdfStampObject,
  PdfTextObject,
} from './types';

/** Default look of an inserted text box (11 pt Helvetica, Office-ish) */
export const DEFAULT_TEXT_STYLE = {
  fontFamily: 'Helvetica',
  fontSize: 11,
  bold: false,
  italic: false,
  color: '#111111',
  align: 'left',
  lineHeight: 1.35,
} as const;

/** Defaults for the annotate tab; the controller may override them per user choice */
export const DEFAULT_ANNOTATION_STYLE = {
  markupColor: '#fde047',
  inkColor: '#e11d48',
  inkWidth: 2,
  shapeStroke: '#e11d48',
  shapeWidth: 2,
  noteIcon: 'note',
  noteColor: '#f59e0b',
} as const;

/** Smallest box we accept, so a stray click never creates a zero-size object */
const MIN_SIZE = 0.005;

/** First z that paints on top: max + 1, starting at 1 so `0` can mean "unset" in debug output */
export function nextZ(objects: readonly PdfObject[]): number {
  let max = 0;
  for (const object of objects) {
    if (object.z > max) max = object.z;
  }
  return max + 1;
}

/** Paint order is ascending `z`; copy first so callers keep their array untouched */
export function sortByZ(objects: readonly PdfObject[]): PdfObject[] {
  return [...objects].sort((a, b) => a.z - b.z);
}

export function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

/** Free object rotation: keep the angle in [0, 360) instead of snapping to quarter turns */
export function normalizeAngle(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return ((value % 360) + 360) % 360;
}

/** Stable id for undo/hit-testing; `crypto.randomUUID` is available in every supported browser */
export function createObjectId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  return `obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface ObjectBaseInput {
  /** `PdfPageState.id` (stable across reorders) */
  page: string;
  /** Normalized rect; clamped into the page */
  rect: NormRect;
  z?: number;
  id?: string;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
}

/** Clamp the shared fields; kept separate from `kind` specific rules */
function baseFields(input: ObjectBaseInput) {
  return {
    id: input.id ?? createObjectId(),
    page: input.page,
    rect: clampNormRect(input.rect),
    z: input.z ?? 1,
    rotation: normalizeAngle(input.rotation ?? 0),
    opacity: clampOpacity(input.opacity ?? 1),
    ...(input.locked ? { locked: true } : {}),
  };
}

/** Give a rect a usable minimum size (text boxes, shapes, images) */
function withMinSize(rect: NormRect, min = MIN_SIZE): NormRect {
  const clamped = clampNormRect(rect);
  const w = Math.min(1, Math.max(min, clamped.w));
  const h = Math.min(1, Math.max(min, clamped.h));
  return {
    x: Math.min(clamped.x, 1 - w),
    y: Math.min(clamped.y, 1 - h),
    w,
    h,
  };
}

/**
 * Final guard applied by every reducer and by the factories: no object can leave the page, carry a
 * NaN angle or an out-of-range alpha.
 *
 * Kind-specific clamps (stroke width, font size, quad count) live in the factories; this keeps the
 * union safe to serialize.
 */
export function clampObject<T extends PdfObject>(object: T): T {
  const common = {
    ...object,
    rect: clampNormRect(object.rect),
    rotation: normalizeAngle(object.rotation),
    opacity: clampOpacity(object.opacity),
    z: Number.isFinite(object.z) ? object.z : 1,
  };

  switch (common.kind) {
    case 'ink':
      return {
        ...common,
        width: clampWidth(common.width),
        points: trimInkPoints(common.points),
      } as T;
    case 'shape':
      return { ...common, width: clampWidth(common.width) } as T;
    case 'markup':
      return {
        ...common,
        quads: common.quads.filter((quad) => quad.w > 0 && quad.h > 0),
      } as T;
    case 'image':
    case 'stamp':
    case 'signature':
      return {
        ...common,
        naturalW: Math.max(1, common.naturalW),
        naturalH: Math.max(1, common.naturalH),
      } as T;
    default:
      return common as T;
  }
}

function clampWidth(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(40, Math.max(0.25, value));
}

function trimInkPoints(points: PdfInkObject['points']): PdfInkObject['points'] {
  const clean = points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({
      x: Math.min(1, Math.max(0, point.x)),
      y: Math.min(1, Math.max(0, point.y)),
    }));
  // A single point would draw nothing; keep at least two so the stroke is valid
  return clean.length >= 2 ? clean : [];
}

/* -------------------------------------------------------------------------- */
/* Text                                                                       */
/* -------------------------------------------------------------------------- */

export interface CreateTextObjectInput extends ObjectBaseInput {
  text: string;
  style?: Partial<
    Pick<
      PdfTextObject,
      | 'fontFamily'
      | 'fontSize'
      | 'bold'
      | 'italic'
      | 'color'
      | 'align'
      | 'lineHeight'
      | 'bg'
      | 'border'
      | 'patch'
    >
  >;
}

export function createTextObject(input: CreateTextObjectInput): PdfTextObject {
  const { style } = input;
  const fontSize = Number.isFinite(style?.fontSize) ? (style?.fontSize as number) : 11;

  return {
    kind: 'text',
    ...baseFields({ ...input, rect: withMinSize(input.rect) }),
    text: input.text,
    fontFamily: style?.fontFamily ?? DEFAULT_TEXT_STYLE.fontFamily,
    fontSize: Math.min(200, Math.max(4, fontSize)),
    bold: style?.bold ?? DEFAULT_TEXT_STYLE.bold,
    italic: style?.italic ?? DEFAULT_TEXT_STYLE.italic,
    color: style?.color ?? DEFAULT_TEXT_STYLE.color,
    align: style?.align ?? DEFAULT_TEXT_STYLE.align,
    lineHeight: style?.lineHeight ?? DEFAULT_TEXT_STYLE.lineHeight,
    bg: style?.bg,
    border: style?.border,
    patch: style?.patch,
  };
}

/* -------------------------------------------------------------------------- */
/* Image / stamp / signature                                                  */
/* -------------------------------------------------------------------------- */

export interface CreateImageObjectInput extends ObjectBaseInput {
  dataUrl: string;
  naturalW: number;
  naturalH: number;
  fit?: PdfImageObject['fit'];
}

export function createImageObject(input: CreateImageObjectInput): PdfImageObject {
  return {
    kind: 'image',
    ...baseFields({ ...input, rect: withMinSize(input.rect) }),
    dataUrl: input.dataUrl,
    naturalW: Math.max(1, input.naturalW || 1),
    naturalH: Math.max(1, input.naturalH || 1),
    fit: input.fit ?? 'contain',
  };
}

export interface CreateStampObjectInput extends ObjectBaseInput {
  dataUrl: string;
  naturalW: number;
  naturalH: number;
  kind?: 'stamp' | 'signature';
}

export function createStampObject(input: CreateStampObjectInput): PdfStampObject {
  return {
    kind: input.kind ?? 'stamp',
    ...baseFields({ ...input, rect: withMinSize(input.rect) }),
    dataUrl: input.dataUrl,
    naturalW: Math.max(1, input.naturalW || 1),
    naturalH: Math.max(1, input.naturalH || 1),
  };
}

/* -------------------------------------------------------------------------- */
/* Ink                                                                        */
/* -------------------------------------------------------------------------- */

export interface CreateInkObjectInput extends Omit<ObjectBaseInput, 'rect'> {
  /** Optional explicit frame; otherwise derived from the points */
  rect?: NormRect;
  /** Page-normalized points (0–1, top-left origin); the factory derives the bounding rect */
  points: Array<{ x: number; y: number }>;
  color?: string;
  width?: number;
  smooth?: boolean;
}

/** Padding around the stroke so the round cap is not clipped by `rect` */
const INK_PADDING = 0.01;

/** Frame used when a factory gets neither points nor an explicit rect */
const FALLBACK_RECT: NormRect = { x: 0.1, y: 0.1, w: 0.2, h: 0.1 };

export function createInkObject(input: CreateInkObjectInput): PdfInkObject {
  const points = trimInkPoints(input.points);
  const frame = withMinSize(
    input.rect ?? (points.length >= 2 ? inkBounds(points, INK_PADDING) : FALLBACK_RECT),
  );
  const base = baseFields({ ...input, rect: frame });
  const width = clampWidth(input.width ?? DEFAULT_ANNOTATION_STYLE.inkWidth);

  return {
    kind: 'ink',
    ...base,
    points: points.map((point) => ({
      x: base.rect.w > 0 ? (point.x - base.rect.x) / base.rect.w : 0,
      y: base.rect.h > 0 ? (point.y - base.rect.y) / base.rect.h : 0,
    })),
    color: input.color ?? DEFAULT_ANNOTATION_STYLE.inkColor,
    width,
    smooth: input.smooth ?? true,
  };
}

function inkBounds(points: Array<{ x: number; y: number }>, padding: number): NormRect {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return {
    x: Math.max(0, minX - padding),
    y: Math.max(0, minY - padding),
    w: Math.min(1, maxX + padding) - Math.max(0, minX - padding),
    h: Math.min(1, maxY + padding) - Math.max(0, minY - padding),
  };
}

/* -------------------------------------------------------------------------- */
/* Markup                                                                     */
/* -------------------------------------------------------------------------- */

export interface CreateMarkupObjectInput extends Omit<ObjectBaseInput, 'rect'> {
  /** Optional explicit frame; otherwise the union of the quads */
  rect?: NormRect;
  type: PdfMarkupObject['type'];
  /** One quad per covered text line, page-normalized */
  quads: NormRect[];
  color?: string;
}

export function createMarkupObject(input: CreateMarkupObjectInput): PdfMarkupObject {
  const quads = input.quads
    .map((quad) => clampNormRect(quad))
    .filter((quad) => quad.w > 0 && quad.h > 0);
  const union = withMinSize(quads.length > 0 ? unionRect(quads) : (input.rect ?? FALLBACK_RECT));

  return {
    kind: 'markup',
    ...baseFields({ ...input, rect: union }),
    type: input.type,
    quads: quads.length > 0 ? quads : [union],
    color: input.color ?? DEFAULT_ANNOTATION_STYLE.markupColor,
  };
}

/** Smallest rect covering all quads (the selection frame of a multi-line highlight) */
export function unionRect(rects: readonly NormRect[]): NormRect {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.w);
    maxY = Math.max(maxY, rect.y + rect.h);
  }
  if (maxX <= minX || maxY <= minY) return { x: minX, y: minY, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/* -------------------------------------------------------------------------- */
/* Shape                                                                      */
/* -------------------------------------------------------------------------- */

export interface CreateShapeObjectInput extends ObjectBaseInput {
  type: PdfShapeObject['type'];
  stroke?: string;
  fill?: string;
  width?: number;
  dash?: number[];
}

export function createShapeObject(input: CreateShapeObjectInput): PdfShapeObject {
  return {
    kind: 'shape',
    ...baseFields({ ...input, rect: withMinSize(input.rect) }),
    type: input.type,
    stroke: input.stroke ?? DEFAULT_ANNOTATION_STYLE.shapeStroke,
    fill: input.fill,
    width: clampWidth(input.width ?? DEFAULT_ANNOTATION_STYLE.shapeWidth),
    dash: input.dash?.filter((value) => value > 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Note                                                                       */
/* -------------------------------------------------------------------------- */

/** Default note box: a small icon-sized rect in the margin */
export const NOTE_SIZE = 0.028;

export interface CreateNoteObjectInput extends ObjectBaseInput {
  body?: string;
  author?: string;
  icon?: PdfNoteObject['icon'];
}

export function createNoteObject(input: CreateNoteObjectInput): PdfNoteObject {
  const rect = withMinSize(input.rect, NOTE_SIZE);
  return {
    kind: 'note',
    ...baseFields({ ...input, rect }),
    body: input.body ?? '',
    author: input.author,
    icon: input.icon ?? DEFAULT_ANNOTATION_STYLE.noteIcon,
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers used by the controller                                             */
/* -------------------------------------------------------------------------- */

/** Re-anchor an object to another page (drag from one thumbnail to another in M2) */
export function moveObjectToPage<T extends PdfObject>(object: T, page: string): T {
  return { ...object, page };
}

/** Copy with a fresh id and z (clipboard paste); callers decide the rect offset */
export function cloneObject<T extends PdfObject>(object: T, overrides: Partial<PdfObject> = {}): T {
  return {
    ...object,
    ...overrides,
    id: createObjectId(),
  } as T;
}

/* -------------------------------------------------------------------------- */
/* Layer order / lock / opacity                                               */
/* -------------------------------------------------------------------------- */

export type ZOrderAction = 'front' | 'back' | 'forward' | 'backward';

/**
 * Move one object within its page's paint order.
 *
 * `z` is re-assigned as 1..n for the affected page (order across pages is irrelevant: only objects
 * of the same page are compared when rendering). Returns the same array when nothing moves so
 * reducers can detect a no-op.
 */
export function reorderZ(objects: PdfObject[], id: string, action: ZOrderAction): PdfObject[] {
  const target = objects.find((object) => object.id === id);
  if (!target) return objects;

  const pageObjects = objects
    .filter((object) => object.page === target.page)
    .sort((a, b) => a.z - b.z);
  const index = pageObjects.findIndex((object) => object.id === id);
  const last = pageObjects.length - 1;
  const nextIndex =
    action === 'front'
      ? last
      : action === 'back'
        ? 0
        : action === 'forward'
          ? Math.min(last, index + 1)
          : Math.max(0, index - 1);
  if (nextIndex === index) return objects;

  const ordered = [...pageObjects];
  ordered.splice(index, 1);
  ordered.splice(nextIndex, 0, target);
  const zById = new Map(ordered.map((object, position) => [object.id, position + 1]));

  return objects.map((object) =>
    object.page === target.page ? { ...object, z: zById.get(object.id) ?? object.z } : object,
  );
}

export function setObjectLocked(objects: PdfObject[], id: string, locked: boolean): PdfObject[] {
  let changed = false;
  const next = objects.map((object) => {
    if (object.id !== id || Boolean(object.locked) === locked) return object;
    changed = true;
    return { ...object, locked: locked || undefined };
  });
  return changed ? next : objects;
}

export function setObjectOpacity(objects: PdfObject[], id: string, opacity: number): PdfObject[] {
  const value = clampOpacity(opacity);
  let changed = false;
  const next = objects.map((object) => {
    if (object.id !== id || object.opacity === value) return object;
    changed = true;
    return { ...object, opacity: value };
  });
  return changed ? next : objects;
}
