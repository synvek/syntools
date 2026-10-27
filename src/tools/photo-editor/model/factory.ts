import type { ToolResult } from '@/core/types';
import { CANVAS_PRESETS, MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from '../core';
import type {
  Adjustments,
  FilterSpec,
  AdjustmentLayer,
  GroupLayer,
  Layer,
  MaskRef,
  PhotoDoc,
  RasterLayer,
  ShapeKind,
  ShapeLayer,
  ShapeStyleDefaults,
  SmartLayer,
  TextLayer,
} from './types';

/** Document and layer factory: pure data construction only, never touches the DOM. */

let seq = 0;

export function createId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

export function createAdjustments(): Adjustments {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
    temperature: 0,
    exposure: 0,
    sharpen: 0,
  };
}

/** Deep copy via a JSON round-trip (`structuredClone` isn't reliable under jsdom; same as slide-editor) */
export function cloneDoc(doc: PhotoDoc): PhotoDoc {
  return JSON.parse(JSON.stringify(doc)) as PhotoDoc;
}

/**
 * Deep-copy a layer (JSON round-trip, the same strategy as cloneDoc).
 * Note: **only the `assetId` / `mask.assetId` references are copied, not pixels** —
 * callers needing independent pixels (duplicated layers, pixel undo snapshots) must also `cloneAsset()`.
 */
export function cloneLayer(layer: Layer, newId = false): Layer {
  const copy = JSON.parse(JSON.stringify(layer)) as Layer;
  if (newId) copy.id = createId(layer.kind);
  return copy;
}

/** New mask reference: a fully white (reveal-all) mask; the caller fills pixels and passes the assetId */
export function createMaskRef(assetId: string, patch: Partial<MaskRef> = {}): MaskRef {
  return {
    assetId,
    rev: 1,
    enabled: true,
    inverted: false,
    density: 1,
    feather: 0,
    ...patch,
  };
}

export interface NewDocOptions {
  width: number;
  height: number;
  name?: string;
  background?: PhotoDoc['background'];
}

/** New document: validates the size and returns a ToolResult (core.ts contract: never throws) */
export function createNewDoc(options: NewDocOptions): ToolResult<PhotoDoc> {
  const width = Math.round(options.width);
  const height = Math.round(options.height);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < MIN_CANVAS_SIZE ||
    height < MIN_CANVAS_SIZE ||
    width > MAX_CANVAS_SIZE ||
    height > MAX_CANVAS_SIZE
  ) {
    return {
      ok: false,
      error: 'INVALID_SIZE',
      params: { min: MIN_CANVAS_SIZE, max: MAX_CANVAS_SIZE },
    };
  }
  return {
    ok: true,
    value: {
      id: createId('doc'),
      // An empty name means "untitled": the UI renders a localized placeholder (see titlePlaceholder)
      name: options.name?.trim() ?? '',
      width,
      height,
      background: options.background ?? 'white',
      layers: [],
      activeLayerId: null,
      swatches: [],
    },
  };
}

/** Default canvas: 1280×720 at 16:9 */
export function createDoc(): PhotoDoc {
  const preset = CANVAS_PRESETS[0];
  const result = createNewDoc({ width: preset.width, height: preset.height });
  return result.ok ? result.value : { ...emptyDoc(), id: createId('doc') };
}

function emptyDoc(): PhotoDoc {
  return {
    id: createId('doc'),
    name: '',
    width: 1280,
    height: 720,
    background: 'white',
    layers: [],
    activeLayerId: null,
    swatches: [],
  };
}

export function createRasterLayer(input: {
  assetId: string;
  width: number;
  height: number;
  /** Empty string = auto-name (the UI shows a localized name built from kind + index) */
  name?: string;
  x?: number;
  y?: number;
}): RasterLayer {
  return {
    id: createId('raster'),
    kind: 'raster',
    name: input.name ?? '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width,
    height: input.height,
    rotation: 0,
    flipX: false,
    flipY: false,
    assetId: input.assetId,
    rev: 1,
    adjustments: createAdjustments(),
    filters: [],
  };
}

export function createTextLayer(input: {
  doc: PhotoDoc;
  text?: string;
  x?: number;
  y?: number;
}): TextLayer {
  const fontSize = Math.max(12, Math.round(Math.min(input.doc.width, input.doc.height) / 12));
  return {
    id: createId('text'),
    kind: 'text',
    name: '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    x: input.x ?? Math.round(input.doc.width * 0.1),
    y: input.y ?? Math.round(input.doc.height * 0.4),
    width: Math.round(input.doc.width * 0.8),
    height: Math.round(fontSize * 1.6),
    rotation: 0,
    flipX: false,
    flipY: false,
    // Empty text lets the caller supply localized default content (see addTextLayer's text parameter)
    text: input.text ?? '',
    fontSize,
    fontFamily: 'PingFang SC',
    fill: '#111827',
    bold: false,
    italic: false,
    underline: false,
    align: 'left',
    lineHeight: 1.4,
    letterSpacing: 0,
    paragraphSpacing: 0,
    warp: { kind: 'none', bend: 0, horizontal: 0 },
  };
}

/**
 * Group: created empty (the UI moves the selected layers in afterwards).
 * Pass-through defaults to true, matching Photoshop's new-group behavior.
 */
export function createGroupLayer(input: {
  doc: PhotoDoc;
  name?: string;
  passThrough?: boolean;
}): GroupLayer {
  return {
    id: createId('group'),
    kind: 'group',
    name: input.name ?? '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    x: 0,
    y: 0,
    width: input.doc.width,
    height: input.doc.height,
    rotation: 0,
    flipX: false,
    flipY: false,
    parentId: null,
    expanded: true,
    mask: null,
    passThrough: input.passThrough ?? true,
  };
}

/** Adjustment layer: all-zero parameters (no effect), applying to every layer below it */
export function createAdjustmentLayer(input: {
  doc: PhotoDoc;
  adjustments?: Partial<Adjustments>;
  filters?: FilterSpec[];
  name?: string;
}): AdjustmentLayer {
  return {
    id: createId('adjust'),
    kind: 'adjustment',
    name: input.name ?? '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    x: 0,
    y: 0,
    width: input.doc.width,
    height: input.doc.height,
    rotation: 0,
    flipX: false,
    flipY: false,
    parentId: null,
    expanded: true,
    mask: null,
    adjustments: { ...createAdjustments(), ...input.adjustments },
    filters: input.filters ?? [],
  };
}

/** Smart object: source pixel size is separate from presentation size, so scaling doesn't resample */
export function createSmartLayer(input: {
  doc: PhotoDoc;
  sourceAssetId: string;
  sourceWidth: number;
  sourceHeight: number;
  name?: string;
  x?: number;
  y?: number;
}): SmartLayer {
  return {
    id: createId('smart'),
    kind: 'smart',
    name: input.name ?? '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.sourceWidth,
    height: input.sourceHeight,
    rotation: 0,
    flipX: false,
    flipY: false,
    parentId: null,
    expanded: true,
    mask: null,
    sourceAssetId: input.sourceAssetId,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    adjustments: createAdjustments(),
    filters: [],
  };
}

export function createShapeLayer(input: {
  doc: PhotoDoc;
  shape: ShapeKind;
  x?: number;
  y?: number;
  /** Default fill / stroke for new shapes (from the options bar; falls back to built-in colors) */
  style?: ShapeStyleDefaults;
}): ShapeLayer {
  const size = Math.round(Math.min(input.doc.width, input.doc.height) * 0.3);
  return {
    id: createId('shape'),
    kind: 'shape',
    name: '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    x: input.x ?? Math.round(input.doc.width * 0.2),
    y: input.y ?? Math.round(input.doc.height * 0.2),
    width: Math.max(24, size),
    height: Math.max(24, size),
    rotation: 0,
    flipX: false,
    flipY: false,
    shape: input.shape,
    fill: input.style?.fill ?? '#2563EB',
    stroke: input.style?.stroke ?? '#1D4ED8',
    strokeWidth: input.style?.strokeWidth ?? 0,
    cornerRadius: input.style?.cornerRadius ?? 12,
  };
}
