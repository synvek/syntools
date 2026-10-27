import type { ToolResult } from '@/core/types';
import type {
  Adjustments,
  BlackWhiteParams,
  BlendMode,
  ChannelMixerParams,
  ColorBalanceParams,
  ColorOverlayStyle,
  CurvePoint,
  CurvesParams,
  DropShadowStyle,
  FilterId,
  InnerShadowStyle,
  LayerStyle,
  MeshWarp,
  OuterGlowStyle,
  TextWarpKind,
  ToolId,
  StrokeStyle,
  FilterSpec,
  GroupLayer,
  Guide,
  HistoryEntry,
  HistoryLabel,
  Layer,
  LevelsParams,
  PhotoDoc,
  PhotoFilterParams,
  Rect,
  Selection,
  SelectionKind,
  SelectionPart,
  SelectiveColorParams,
  SelectiveRange,
  ShadowsHighlightsParams,
  ShapeKind,
  ReplaceColorParams,
  VectorMaskRef,
} from './model/types';

/**
 * Pure-function layer: no Konva, no DOM (unit-testable and safe to load during prerender).
 * Validations that persist or report errors return `ToolResult<T>`; see `err.*` in `strings.ts` for messages.
 */

export const MIN_CANVAS_SIZE = 16;
export const MAX_CANVAS_SIZE = 4096;
export const MIN_BRUSH = 1;
export const MAX_BRUSH = 400;
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024; // 30MB
export const MAX_PROJECT_BYTES = 60 * 1024 * 1024; // 60MB
/** PSD import cap: multi-layer project files are usually far larger than plain images */
export const MAX_PSD_BYTES = 128 * 1024 * 1024; // 128MB

export interface CanvasPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

/**
 * Common canvas presets: square / landscape / portrait / paper.
 * Labels only use numbers + aspect ratio + paper name, with no natural language, so they need no translation
 * (text lives in `CanvasPreset.label`; all other enum names are localized by the UI, see `blend.*` / `shape.*`).
 */
export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: 'hd', label: '1280 × 720 · 16:9', width: 1280, height: 720 },
  { id: 'square', label: '1080 × 1080 · 1:1', width: 1080, height: 1080 },
  { id: 'photo43', label: '1024 × 768 · 4:3', width: 1024, height: 768 },
  { id: 'portrait', label: '1080 × 1350 · 4:5', width: 1080, height: 1350 },
  { id: 'a4', label: 'A4 · 2480 × 3508', width: 2480, height: 3508 },
];

/** Blend modes: ids only; the UI resolves names via `tools.photo.blend.<id>` for the active locale */
export const BLEND_MODES: BlendMode[] = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'soft-light',
  'hard-light',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
];

/** Filters: ids only; the UI resolves names and hints via `tools.photo.filter*` / `hint*` for the active locale */
export const FILTERS: FilterId[] = [
  'grayscale',
  'sepia',
  'invert',
  'blur',
  'gaussianBlur',
  'motionBlur',
  'sharpen',
  'unsharp',
  'emboss',
  'edge',
  'noise',
  'pixelate',
  'posterize',
  // Distort
  'twirl',
  'spherize',
  'pinch',
  // Stylize
  'findEdges',
  'traceContour',
  // Render
  'clouds',
  'lensFlare',
  // Noise reduction
  'reduceNoise',
];

/**
 * Filter groups (the panel renders one section per group).
 *
 * Growing from 13 to 21 filters made a flat two-column grid hard to scan; the order follows Photoshop's menus.
 */
export const FILTER_GROUPS: { id: string; items: FilterId[] }[] = [
  {
    id: 'basic',
    items: ['grayscale', 'sepia', 'invert', 'noise', 'pixelate', 'posterize'],
  },
  { id: 'blur', items: ['blur', 'gaussianBlur', 'motionBlur', 'reduceNoise'] },
  { id: 'sharpen', items: ['sharpen', 'unsharp'] },
  { id: 'stylize', items: ['emboss', 'edge', 'findEdges', 'traceContour'] },
  { id: 'distort', items: ['twirl', 'spherize', 'pinch'] },
  { id: 'render', items: ['clouds', 'lensFlare'] },
];

/** Filter parameter spec: the UI builds sliders from it (labels go through `tools.photo.<label>`) */
export interface FilterParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  default: number;
}

export const FILTER_PARAMS: Record<FilterId, FilterParamSpec[]> = {
  grayscale: [],
  sepia: [],
  invert: [],
  blur: [{ key: 'radius', label: 'paramRadius', min: 1, max: 40, default: 4 }],
  gaussianBlur: [{ key: 'radius', label: 'paramRadius', min: 0, max: 60, default: 6 }],
  motionBlur: [
    { key: 'angle', label: 'paramAngle', min: 0, max: 359, default: 0 },
    { key: 'distance', label: 'paramDistance', min: 2, max: 80, default: 12 },
  ],
  sharpen: [{ key: 'amount', label: 'paramAmount', min: 0, max: 100, default: 50 }],
  unsharp: [
    { key: 'radius', label: 'paramRadius', min: 1, max: 20, default: 2 },
    { key: 'amount', label: 'paramAmount', min: 0, max: 200, default: 80 },
  ],
  emboss: [{ key: 'amount', label: 'paramAmount', min: 0, max: 100, default: 100 }],
  edge: [],
  noise: [
    { key: 'amount', label: 'paramAmount', min: 0, max: 128, default: 24 },
    { key: 'mono', label: 'paramMono', min: 0, max: 1, step: 1, default: 1 },
  ],
  pixelate: [{ key: 'block', label: 'paramBlock', min: 2, max: 64, default: 8 }],
  posterize: [{ key: 'levels', label: 'paramLevels', min: 2, max: 16, default: 4 }],
  twirl: [{ key: 'angle', label: 'paramAngle', min: -360, max: 360, default: 90 }],
  spherize: [{ key: 'amount', label: 'paramAmount', min: -100, max: 100, default: 60 }],
  pinch: [{ key: 'amount', label: 'paramAmount', min: 0, max: 100, default: 50 }],
  findEdges: [],
  traceContour: [{ key: 'level', label: 'paramLevel', min: 0, max: 255, default: 128 }],
  clouds: [
    { key: 'amount', label: 'paramAmount', min: 0, max: 100, default: 70 },
    { key: 'size', label: 'paramSize', min: 2, max: 60, default: 16 },
  ],
  lensFlare: [
    { key: 'amount', label: 'paramAmount', min: 0, max: 200, default: 80 },
    { key: 'size', label: 'paramSize', min: 10, max: 100, default: 40 },
    { key: 'x', label: 'paramX', min: 0, max: 100, default: 70 },
    { key: 'y', label: 'paramY', min: 0, max: 100, default: 30 },
  ],
  reduceNoise: [
    { key: 'amount', label: 'paramAmount', min: 0, max: 100, default: 70 },
    { key: 'radius', label: 'paramRadius', min: 1, max: 3, default: 1 },
  ],
};

/** Default filter parameters (written when a filter instance is created) */
export function defaultFilterParams(id: FilterId): Record<string, number> {
  const out: Record<string, number> = {};
  for (const spec of FILTER_PARAMS[id]) out[spec.key] = spec.default;
  return out;
}

/** Read a filter parameter: missing / invalid values fall back to that parameter's default */
export function filterParam(spec: FilterSpec, key: string): number {
  const value = spec.params?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return FILTER_PARAMS[spec.id].find((item) => item.key === key)?.default ?? 0;
}

/** Filters expressible through CSS `filter` (the rest go through the pixel pipeline) */
const CSS_FILTERS: FilterId[] = ['grayscale', 'sepia', 'invert', 'blur', 'gaussianBlur'];

export function isCssFilter(id: FilterId): boolean {
  return CSS_FILTERS.includes(id);
}

/** Shapes: ids only; the UI resolves names via `tools.photo.shape.<id>` for the active locale */
export const SHAPE_KINDS: ShapeKind[] = ['rect', 'roundRect', 'ellipse', 'line', 'arrow', 'star'];

/* ------------------------------ Ruler ticks ------------------------------ */

/** Candidate ruler steps (px): the first that stays ≥ the minimum gap once scaled, so ticks never crowd */
const RULER_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];

export interface RulerTick {
  /** Screen coordinates (relative to the top-left corner of the canvas host) */
  screen: number;
  /** Document coordinates */
  doc: number;
  label: string;
}

/**
 * Compute ruler ticks: `offset` is the viewport pan (screen px) and `scale` is the zoom factor.
 * Pure function (unit-testable): it only maps document → screen coordinates and picks the step.
 */
export function rulerTicks(
  scale: number,
  offset: number,
  length: number,
  minGap = 56,
): RulerTick[] {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const step =
    RULER_STEPS.find((value) => value * s >= minGap) ?? RULER_STEPS[RULER_STEPS.length - 1];
  const firstDoc = Math.ceil((0 - offset) / s / step) * step;
  const lastDoc = (length - offset) / s;
  const ticks: RulerTick[] = [];
  for (let doc = firstDoc; doc <= lastDoc; doc += step) {
    ticks.push({ screen: offset + doc * s, doc, label: String(Math.round(doc)) });
    if (ticks.length > 500) break;
  }
  return ticks;
}

/** Clamp a number: invalid values fall back to min (same as doodle-board's clampBrushSize) */
export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function clampBrushSize(value: number): number {
  return Math.round(clampNumber(value, MIN_BRUSH, MAX_BRUSH));
}

/* ------------------------------ Brushes / painting ------------------------------ */

/** Brush spacing (fraction of the diameter): 0.02 looks continuous, above 1 leaves visible gaps */
export const MIN_SPACING = 0.02;
export const MAX_SPACING = 2;

export function clampSpacing(value: number): number {
  if (!Number.isFinite(value)) return 0.1;
  return Math.min(MAX_SPACING, Math.max(MIN_SPACING, value));
}

/**
 * When spacing is small enough (≤ 5%) stroke one continuous path; otherwise stamp once per spacing step.
 * The threshold exists because a continuous path is faster and smoother, while wide spacing needs real stamps.
 */
export const SPACING_LINE_THRESHOLD = 0.05;

/** Brush preset: a reusable set of brush parameters */
export interface BrushPreset {
  id: string;
  /** Built-in presets have i18n names (`tools.photo.preset<Id>`); custom presets carry their own name */
  name?: string;
  size: number;
  hardness: number;
  opacity: number;
  spacing: number;
}

export const DEFAULT_BRUSH_PRESETS: BrushPreset[] = [
  { id: 'hardRound', size: 12, hardness: 1, opacity: 1, spacing: 0.1 },
  { id: 'softRound', size: 40, hardness: 0.15, opacity: 0.6, spacing: 0.15 },
  { id: 'pencil', size: 2, hardness: 1, opacity: 1, spacing: 0.05 },
  { id: 'marker', size: 24, hardness: 0.8, opacity: 0.9, spacing: 0.08 },
  { id: 'spray', size: 60, hardness: 0, opacity: 0.25, spacing: 0.4 },
];

/** Normalize presets: drop invalid entries and clamp parameters into their valid ranges */
export function normalizeBrushPresets(value: unknown): BrushPreset[] {
  if (!Array.isArray(value)) return [];
  const out: BrushPreset[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Partial<BrushPreset>;
    if (typeof raw.id !== 'string' || raw.id.length === 0) continue;
    out.push({
      id: raw.id,
      name: typeof raw.name === 'string' && raw.name.length > 0 ? raw.name : undefined,
      size: clampBrushSize(Number(raw.size)),
      hardness: clampNumber(Number(raw.hardness), 0, 1),
      opacity: clampNumber(Number(raw.opacity), 0, 1),
      spacing: clampSpacing(Number(raw.spacing)),
    });
    if (out.length >= 24) break;
  }
  return out;
}

/* ------------------------------ Channels / sampling / palette ------------------------------ */

/** Channel view: `rgb` = normal, others isolate one channel as grayscale (display only, not the document) */
export type ChannelView = 'rgb' | 'red' | 'green' | 'blue';
export const CHANNEL_VIEWS: ChannelView[] = ['rgb', 'red', 'green', 'blue'];
/** The three color channels that can be isolated on their own */
export const COLOR_CHANNELS: Exclude<ChannelView, 'rgb'>[] = ['red', 'green', 'blue'];

/** Maximum number of color-sampler points kept (same as Photoshop) */
export const MAX_SAMPLES = 4;

export interface SamplePoint {
  /** Document coordinates (pixel center, rounded) */
  x: number;
  y: number;
  /** `#RRGGBB` */
  hex: string;
  /** 0~255: used to flag transparent pixels */
  alpha: number;
}

/** Default palette capacity */
export const PALETTE_SIZE = 8;
/** Quantization when extracting the palette (bits shifted per channel): 4 bit → 4096 color buckets */
const PALETTE_QUANTIZE_SHIFT = 4;

/**
 * Single-channel isolation: replace the RGBA data in place with that channel's grayscale.
 *
 * Matches Photoshop's single-channel view: only that channel's luminance counts, so all three render as grayscale
 * instead of tinting the R channel red.
 */
export function extractChannelData(
  data: Uint8ClampedArray,
  channel: Exclude<ChannelView, 'rgb'>,
): void {
  const offset = channel === 'red' ? 0 : channel === 'green' ? 1 : 2;
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i + offset];
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
}

/**
 * Binary mask → selection outlines (scanline method).
 *
 * Row by row, find runs where "value ≥ threshold" and emit one rectangular outline per run as a **union**.
 * The result is stair-stepped (blocky): that is the inherent precision of scanlines, traded for zero deps and O(n);
 * good enough to turn quick mask / channels into an editable selection without pulling in marching squares.
 *
 * `source` picks which quantity to test:
 * - `luma` (default): luminance, for channel views and grayscale masks (white = selected, black = not selected);
 * - `alpha`: opacity, for alpha masks (transparent = not selected).
 */
export function maskRunsToParts(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 128,
  source: 'luma' | 'alpha' = 'luma',
): SelectionPart[] {
  const parts: SelectionPart[] = [];
  const rect = (x0: number, y0: number, x1: number, y1: number): number[] => [
    x0,
    y0,
    x1,
    y0,
    x1,
    y1,
    x0,
    y1,
  ];
  for (let y = 0; y < height; y += 1) {
    let start = -1;
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const value =
        source === 'alpha'
          ? data[offset + 3]
          : data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
      const on = value >= threshold;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        parts.push({ path: rect(start, y, x, y + 1), add: true });
        start = -1;
      }
    }
    if (start >= 0) parts.push({ path: rect(start, y, width, y + 1), add: true });
    // Outline guard: a very noisy mask yields swarms of rects, so truncate and let the caller warn
    if (parts.length >= MAX_VECTOR_CONTOURS * 8) return parts;
  }
  return parts;
}

/** Derive the selection bounds from the scanline rect union (its bounding box) */
export function partsBounds(parts: SelectionPart[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const part of parts) {
    const path = part.path;
    for (let i = 0; i < path.length; i += 2) {
      minX = Math.min(minX, path[i]);
      maxX = Math.max(maxX, path[i]);
      minY = Math.min(minY, path[i + 1]);
      maxY = Math.max(maxY, path[i + 1]);
    }
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Luminance threshold when loading quick mask / channels as a selection: white (≥128) counts as selected */
export const MASK_SELECTION_THRESHOLD = 128;

/**
 * Grayscale mask → selection (white = selected, black = not selected).
 *
 * Shared by exiting quick mask and "load channel as selection": both turn one grayscale image into a selection.
 */
export function selectionFromMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = MASK_SELECTION_THRESHOLD,
): Selection | null {
  return selectionFromParts(maskRunsToParts(data, width, height, threshold, 'luma'));
}

/** Assemble a selection from scanline outlines (the single path from quick mask / channels to a selection) */
export function selectionFromParts(parts: SelectionPart[]): Selection | null {
  const usable = parts.filter((part) => part.path.length >= 6);
  if (usable.length === 0) return null;
  const bounds = partsBounds(usable);
  return {
    kind: 'lasso',
    x: bounds.x,
    y: bounds.y,
    width: Math.max(1, bounds.width),
    height: Math.max(1, bounds.height),
    path: [],
    feather: 0,
    // First run becomes the main outline, the rest append as unions (a rect union under nonzero fill)
    parts: usable.map((part, index) => ({ path: part.path, add: index === 0 ? true : part.add })),
  };
}

/**
 * Extract the palette (dominant colors) from pixel data.
 *
 * Method: bucket by `PALETTE_QUANTIZE_SHIFT` bits → count pixels and sum colors per bucket → average the most
 * populated buckets, then de-duplicate by "minimum distance to an already picked color" so similar hues don't
 * take several slots. Nearly transparent pixels are skipped (their RGB is mostly 0, which would push in black).
 */
export function extractPalette(data: Uint8ClampedArray, count = PALETTE_SIZE): string[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  const shift = PALETTE_QUANTIZE_SHIFT;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> shift) << 8) | ((g >> shift) << 4) | (b >> shift);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.n += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { n: 1, r, g, b });
    }
  }
  const ranked = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, count * 4)
    .map((bucket) => rgbToHex(bucket.r / bucket.n, bucket.g / bucket.n, bucket.b / bucket.n));

  const picked: string[] = [];
  for (const hex of ranked) {
    if (picked.length >= count) break;
    const rgb = hexToRgb(hex);
    if (!rgb) continue;
    if (picked.every((existing) => colorDistance(existing, rgb) > 40)) picked.push(hex);
  }
  return picked;
}

/** Euclidean distance between two colors (0~441), used to de-duplicate the palette (`hexToRgb` lives further down) */
function colorDistance(hex: string, rgb: { r: number; g: number; b: number }): number {
  const parsed = hexToRgb(hex);
  if (!parsed) return 0;
  return Math.hypot(parsed.r - rgb.r, parsed.g - rgb.g, parsed.b - rgb.b);
}

/* ------------------------------ View rotation ------------------------------ */

/** View rotation step (degrees): the menu advances by 15°, matching Photoshop's presets */
export const VIEW_ROTATION_STEP = 15;

/** Normalize the angle into (-180, 180] so repeated rotations don't pile up values like ±1000° */
export function normalizeViewRotation(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  let value = degrees % 360;
  if (value > 180) value -= 360;
  if (value <= -180) value += 360;
  return Math.round(value * 100) / 100;
}

/** Viewport center: the shared anchor for rotation and zoom */
export function viewCenter(size: { width: number; height: number }): { x: number; y: number } {
  return { x: size.width / 2, y: size.height / 2 };
}

function rotate(px: number, py: number, radians: number): { x: number; y: number } {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: px * cos - py * sin, y: px * sin + py * cos };
}

/**
 * Viewport pan (unrotated) → Konva layer position.
 *
 * Semantics: `viewport.x / y` always holds the **unrotated** screen position of the document's top-left
 * corner (scrollbars, scrolling and fit rely on it); rotation is about the viewport center, so the position is
 * `P = C + R(θ)·(t − C)`.
 */
export function stagePosition(
  viewport: { x: number; y: number },
  size: { width: number; height: number },
  rotationDegrees: number,
): { x: number; y: number } {
  if (!rotationDegrees) return { x: viewport.x, y: viewport.y };
  const center = viewCenter(size);
  const offset = rotate(
    viewport.x - center.x,
    viewport.y - center.y,
    (rotationDegrees * Math.PI) / 180,
  );
  return { x: center.x + offset.x, y: center.y + offset.y };
}

/** Document coordinates → screen coordinates (including view rotation) */
export function docToScreen(
  point: { x: number; y: number },
  viewport: { x: number; y: number; scale: number },
  size: { width: number; height: number },
  rotationDegrees: number,
): { x: number; y: number } {
  const scale = viewport.scale > 0 ? viewport.scale : 1;
  const center = viewCenter(size);
  const local = rotate(
    viewport.x + point.x * scale - center.x,
    viewport.y + point.y * scale - center.y,
    (rotationDegrees * Math.PI) / 180,
  );
  return { x: center.x + local.x, y: center.y + local.y };
}

/** Screen coordinates → document coordinates (including view rotation); inverse of `docToScreen` */
export function screenToDoc(
  point: { x: number; y: number },
  viewport: { x: number; y: number; scale: number },
  size: { width: number; height: number },
  rotationDegrees: number,
): { x: number; y: number } {
  const scale = viewport.scale > 0 ? viewport.scale : 1;
  const center = viewCenter(size);
  const local = rotate(point.x - center.x, point.y - center.y, (-rotationDegrees * Math.PI) / 180);
  // Inverse: R(−θ)(screen − C) = v + p·s − C  →  p = (C + R(−θ)(screen − C) − v) / s
  return {
    x: (center.x + local.x - viewport.x) / scale,
    y: (center.y + local.y - viewport.y) / scale,
  };
}

/** Bounds of the document after rotation (fit and clamping use it, or rotation would crop the canvas) */
export function rotatedDocBounds(
  doc: { width: number; height: number },
  rotationDegrees: number,
): { width: number; height: number } {
  if (!rotationDegrees) return { width: doc.width, height: doc.height };
  const radians = (rotationDegrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    width: doc.width * cos + doc.height * sin,
    height: doc.width * sin + doc.height * cos,
  };
}

/* ------------------------------ Snapping (smart guides) ------------------------------ */

/** Snap threshold (screen px): divide by the current zoom to convert into document units */
export const SNAP_THRESHOLD_PX = 6;

/** Snap candidate lines (document coordinates) */
export interface SnapTargets {
  /** Vertical candidate lines: snap x */
  vertical: number[];
  /** Horizontal candidate lines: snap y */
  horizontal: number[];
}

/** Snap guides currently in effect (drawn on the overlay) */
export interface SnapGuide {
  /** `x` = vertical guide (produced by an x snap), `y` = horizontal guide */
  axis: 'x' | 'y';
  /** Document coordinates */
  position: number;
}

export interface SnapOutcome {
  x: number;
  y: number;
  guides: SnapGuide[];
}

/**
 * Collect snap candidate lines.
 *
 * Sources match Photoshop's "align": canvas edges and center, edges and centers of other visible layers, guides;
 * grid lines are not expanded up front (their count explodes with size) but rounded on the fly while testing.
 */
export function collectSnapTargets(
  doc: PhotoDoc,
  options: { excludeLayerId?: string | null; guides?: readonly Guide[] } = {},
): SnapTargets {
  const vertical = [0, doc.width / 2, doc.width];
  const horizontal = [0, doc.height / 2, doc.height];
  for (const layer of doc.layers) {
    if (layer.id === options.excludeLayerId || !layer.visible) continue;
    vertical.push(layer.x, layer.x + layer.width / 2, layer.x + layer.width);
    horizontal.push(layer.y, layer.y + layer.height / 2, layer.y + layer.height);
  }
  for (const guide of options.guides ?? []) {
    if (guide.axis === 'v') vertical.push(guide.pos);
    else horizontal.push(guide.pos);
  }
  return { vertical, horizontal };
}

/**
 * Snapping while dragging: pull the box position onto the nearest candidate line.
 *
 * The test measures the nearest distance between the box's own three lines (left / center / right,
 * top / middle / bottom) and the candidates, so left-, center- and right-aligned drags all stick.
 */
export function snapBoxPosition(
  box: { x: number; y: number; width: number; height: number },
  targets: SnapTargets,
  threshold: number,
  options: { enabled?: boolean; gridSize?: number } = {},
): SnapOutcome {
  if (options.enabled === false || threshold <= 0) {
    return { x: box.x, y: box.y, guides: [] };
  }
  const gridSize = options.gridSize && options.gridSize > 0 ? options.gridSize : 0;
  const nearest = (values: number[], candidates: readonly number[]) => {
    let best: { delta: number; position: number } | null = null;
    const consider = (candidate: number, value: number) => {
      const delta = candidate - value;
      if (Math.abs(delta) > threshold) return;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, position: candidate };
    };
    for (const value of values) {
      for (const candidate of candidates) consider(candidate, value);
    }
    // Grid snaps only the top-left corner: with all three lines in play, a small layer's center line wins,
    // leaving the layer half a cell off the grid, which looks misaligned
    if (gridSize > 0 && values.length > 0) {
      consider(Math.round(values[0] / gridSize) * gridSize, values[0]);
    }
    return best as { delta: number; position: number } | null;
  };

  const horizontal = nearest([box.x, box.x + box.width / 2, box.x + box.width], targets.vertical);
  const vertical = nearest([box.y, box.y + box.height / 2, box.y + box.height], targets.horizontal);
  const guides: SnapGuide[] = [];
  if (horizontal) guides.push({ axis: 'x', position: horizontal.position });
  if (vertical) guides.push({ axis: 'y', position: vertical.position });
  return {
    x: box.x + (horizontal?.delta ?? 0),
    y: box.y + (vertical?.delta ?? 0),
    guides,
  };
}

/* ------------------------------ Stamp stepping / retouch family ------------------------------ */

/** Retouch family (tools that act stamp by stamp along a stroke) */
export type RepairTool =
  'cloneStamp' | 'healing' | 'spotHeal' | 'smudge' | 'blurBrush' | 'sharpenBrush';

export const REPAIR_TOOLS: RepairTool[] = [
  'cloneStamp',
  'healing',
  'spotHeal',
  'smudge',
  'blurBrush',
  'sharpenBrush',
];

/** Healing tools that require "Alt + click to sample" */
export function needsCloneSource(tool: ToolId): boolean {
  return tool === 'cloneStamp' || tool === 'healing';
}

/** Stamp spacing (fraction of the diameter): smudge / blur need continuity, so tighter than dodge and burn */
export const REPAIR_SPACING = 0.15;
/** Stamp cap per pointermove: keeps a stray jump from painting thousands of stamps */
export const MAX_STAMPS_PER_MOVE = 4096;

export interface StampStep {
  /** Positions to stamp this time (including interpolation from the start point) */
  positions: { x: number; y: number }[];
  /** "Distance left before the next stamp", handed to the next call */
  next: number;
}

/**
 * Interpolate every stamp position along "previous point → current point" (pure function).
 *
 * Extracted because stamp / healing / smudge / blur-sharpen / dodge-burn share one stepping rule, and a
 * per-tool copy with a wrong accumulator shows up as "stamps thin out when moving fast", near impossible to debug.
 */
export function walkStamps(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  step: number,
  travelled: number,
): StampStep {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-6) return { positions: [], next: travelled };
  const ux = dx / distance;
  const uy = dy / distance;
  const positions: { x: number; y: number }[] = [];
  let walked = travelled;
  while (walked <= distance && positions.length < MAX_STAMPS_PER_MOVE) {
    positions.push({ x: fromX + ux * walked, y: fromY + uy * walked });
    walked += step;
  }
  return { positions, next: Math.max(0, walked - distance) };
}

/** Stamp edge falloff: 1 at the center → 0 at the edge (squared, closer to a soft brush than linear) */
export function stampFalloff(distance: number): number {
  if (distance >= 1) return 0;
  const value = 1 - distance;
  return value * value;
}

/**
 * Healing color pick: the per-channel offset that moves the source mean onto the target mean.
 *
 * The healing brush wants source texture with target color, so this offset is added while copying pixels.
 */
export function healOffset(
  sourceMean: readonly number[],
  targetMean: readonly number[],
): [number, number, number] {
  return [
    (targetMean[0] ?? 0) - (sourceMean[0] ?? 0),
    (targetMean[1] ?? 0) - (sourceMean[1] ?? 0),
    (targetMean[2] ?? 0) - (sourceMean[2] ?? 0),
  ];
}

/** Blend one channel: move `value` toward `target` by `weight` */
export function mixChannel(value: number, target: number, weight: number): number {
  const amount = Number.isFinite(weight) ? Math.min(1, Math.max(0, weight)) : 0;
  return value + (target - value) * amount;
}

/* ------------------------------ Mesh warp (perspective / distort / skew / warp) ------------------------------ */

/** The four modes of the free-transform family (`free` = plain free transform) */
export type TransformMode = 'free' | 'perspective' | 'distort' | 'skew' | 'warp';
export const TRANSFORM_MODES: TransformMode[] = ['free', 'perspective', 'distort', 'skew', 'warp'];

/** Control-point shift cap (relative to layer width / height): ±50%, so a layer can never be dragged too far */
export const MAX_MESH_OFFSET = 0.5;
/** Warp mesh size: 4×4 = 16 control points, same as Photoshop */
export const WARP_COLS = 4;
export const WARP_ROWS = 4;

export function clampMeshOffset(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_MESH_OFFSET, Math.max(-MAX_MESH_OFFSET, value));
}

/** All-zero mesh (no warp) */
export function createMesh(cols: number, rows: number): MeshWarp {
  return { cols, rows, points: new Array(cols * rows * 2).fill(0) };
}

/** Four-corner mesh: perspective / distort / skew share one storage, differing only in interaction constraints */
export function createQuadMesh(): MeshWarp {
  return createMesh(2, 2);
}

export function meshIsIdentity(mesh?: MeshWarp | null): boolean {
  if (!mesh) return true;
  if (mesh.cols < 2 || mesh.rows < 2) return true;
  if (mesh.points.length !== mesh.cols * mesh.rows * 2) return true;
  return mesh.points.every((value) => value === 0);
}

/**
 * Validate / normalize an external mesh (shared by the migration and import entry points).
 * Only 2×2 (four corners) and 4×4 (warp) are accepted: other sizes have no interaction behind them, so drop
 * them rather than keep half-baked data. An all-zero mesh returns undefined: "equivalent to no warp" shouldn't exist.
 */
export function normalizeMesh(value: unknown): MeshWarp | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<MeshWarp>;
  const cols = Math.round(Number(raw.cols));
  const rows = Math.round(Number(raw.rows));
  if (!Number.isFinite(cols) || !Number.isFinite(rows)) return undefined;
  if (!((cols === 2 && rows === 2) || (cols === WARP_COLS && rows === WARP_ROWS))) return undefined;
  if (!Array.isArray(raw.points) || raw.points.length !== cols * rows * 2) return undefined;
  const mesh: MeshWarp = {
    cols,
    rows,
    points: raw.points.map((item) => clampMeshOffset(Number(item) || 0)),
  };
  return meshIsIdentity(mesh) ? undefined : mesh;
}

/**
 * Extra padding the mesh warp needs (px), estimated from the largest absolute offset in the displacement field.
 *
 * Purpose: composite buffers (mask / layer styles) and the warped bitmap grow by it, else content gets clipped.
 */
export function meshPadding(
  mesh: MeshWarp | null | undefined,
  width: number,
  height: number,
): number {
  if (meshIsIdentity(mesh)) return 0;
  const grid = mesh as MeshWarp;
  let maxDx = 0;
  let maxDy = 0;
  for (let index = 0; index < grid.points.length; index += 2) {
    maxDx = Math.max(maxDx, Math.abs(grid.points[index] ?? 0));
    maxDy = Math.max(maxDy, Math.abs(grid.points[index + 1] ?? 0));
  }
  return Math.ceil(Math.max(maxDx * width, maxDy * height));
}

/** Cache signature (rendering uses it to decide whether to rebuild the bitmap) */
export function meshSignature(mesh?: MeshWarp | null): string {
  if (meshIsIdentity(mesh)) return '';
  const value = mesh as MeshWarp;
  return `${value.cols}x${value.rows}:${value.points.map((item) => item.toFixed(4)).join(',')}`;
}

/** Normalized position of each control point inside the undeformed box (row-major) */
function meshBaseParam(mesh: MeshWarp, index: number): { u: number; v: number } {
  const col = index % mesh.cols;
  const row = Math.floor(index / mesh.cols);
  return { u: col / (mesh.cols - 1), v: row / (mesh.rows - 1) };
}

export interface MeshControlPoint {
  col: number;
  row: number;
  /** Current control point (including warp offset) */
  x: number;
  y: number;
  /** Position when undeformed (needed for the grid reference lines) */
  baseX: number;
  baseY: number;
}

/**
 * Document coordinates of a control point.
 *
 * `rotated` decides whether layer rotation is applied: **overlays (the Konva overlay is unrotated) must pass true**,
 * while Canvas2D paint paths already applied it outside and must pass false, or the rotation doubles.
 */
export function meshControlPoints(
  mesh: MeshWarp,
  box: LayerBox,
  rotated = true,
): MeshControlPoint[] {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const rad = (box.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const place = (x: number, y: number) => {
    if (!rotated) return { x, y };
    const dx = x - centerX;
    const dy = y - centerY;
    return { x: centerX + dx * cos - dy * sin, y: centerY + dx * sin + dy * cos };
  };
  const out: MeshControlPoint[] = [];
  for (let index = 0; index < mesh.cols * mesh.rows; index += 1) {
    const { u, v } = meshBaseParam(mesh, index);
    const baseX = box.x + u * box.width;
    const baseY = box.y + v * box.height;
    const x = baseX + (mesh.points[index * 2] ?? 0) * box.width;
    const y = baseY + (mesh.points[index * 2 + 1] ?? 0) * box.height;
    const point = place(x, y);
    const base = place(baseX, baseY);
    out.push({
      col: index % mesh.cols,
      row: Math.floor(index / mesh.cols),
      x: point.x,
      y: point.y,
      baseX: base.x,
      baseY: base.y,
    });
  }
  return out;
}

/**
 * Document point → normalized box coordinates (u, v ∈ [0,1] in the undeformed frame).
 * Pairs with `meshControlPoints(rotated = true)`: turns a pointer position into control-point parameters.
 */
export function meshParamAt(
  box: LayerBox,
  px: number,
  py: number,
  rotated = true,
): { u: number; v: number } {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  let dx = px - centerX;
  let dy = py - centerY;
  if (rotated) {
    const rad = (-box.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    dx = rx;
    dy = ry;
  }
  return {
    u: dx / Math.max(1, box.width) + 0.5,
    v: dy / Math.max(1, box.height) + 0.5,
  };
}

/**
 * New mesh after dragging a control point.
 *
 * All differences between the four modes are folded into this pure function (easy to unit test):
 * - `distort`: the dragged point moves alone;
 * - `perspective`: dragging a corner moves the two adjacent corners along their own edges → a proper trapezoid;
 * - `skew`: dragging an edge midpoint moves both endpoints of that edge together → a shear;
 * - `warp`: any control point moves freely.
 */
export function dragMeshPoint(
  mesh: MeshWarp,
  index: number,
  u: number,
  v: number,
  mode: TransformMode,
): MeshWarp {
  if (index < 0 || index >= mesh.cols * mesh.rows) return mesh;
  const { u: u0, v: v0 } = meshBaseParam(mesh, index);
  const du = clampMeshOffset(u - u0);
  const dv = clampMeshOffset(v - v0);
  const col = index % mesh.cols;
  const row = Math.floor(index / mesh.cols);
  const points = mesh.points.slice();
  const set = (targetCol: number, targetRow: number, ox: number, oy: number) => {
    const target = targetRow * mesh.cols + targetCol;
    points[target * 2] = clampMeshOffset(ox);
    points[target * 2 + 1] = clampMeshOffset(oy);
  };
  set(col, row, du, dv);

  if (mode === 'perspective') {
    // Neighbors inherit only the component along their own edge: horizontal edges take dx, vertical ones dy
    set(mesh.cols - 1 - col, row, du, 0);
    set(col, mesh.rows - 1 - row, 0, dv);
  }
  return { ...mesh, points };
}

export type MeshEdge = 'top' | 'bottom' | 'left' | 'right';

/**
 * New mesh after dragging an edge (skew): both endpoints of that edge move together.
 *
 * Complementary to corner dragging: skew means a shear (whole edge shifts), and a 2×2 mesh has no edge
 * midpoints to drag, so the edge itself becomes the handle.
 */
export function dragMeshEdge(mesh: MeshWarp, edge: MeshEdge, du: number, dv: number): MeshWarp {
  const points = mesh.points.slice();
  const lastCol = mesh.cols - 1;
  const lastRow = mesh.rows - 1;
  const targets: number[] =
    edge === 'top'
      ? Array.from({ length: mesh.cols }, (_, col) => col)
      : edge === 'bottom'
        ? Array.from({ length: mesh.cols }, (_, col) => lastRow * mesh.cols + col)
        : edge === 'left'
          ? Array.from({ length: mesh.rows }, (_, row) => row * mesh.cols)
          : Array.from({ length: mesh.rows }, (_, row) => row * mesh.cols + lastCol);
  for (const index of targets) {
    points[index * 2] = clampMeshOffset((mesh.points[index * 2] ?? 0) + du);
    points[index * 2 + 1] = clampMeshOffset((mesh.points[index * 2 + 1] ?? 0) + dv);
  }
  return { ...mesh, points };
}

/** Which edge was hit (tolerance in normalized box coordinates); null when none */
export function meshEdgeAt(
  u: number,
  v: number,
  toleranceU: number,
  toleranceV: number,
): MeshEdge | null {
  if (v <= toleranceV) return 'top';
  if (v >= 1 - toleranceV) return 'bottom';
  if (u <= toleranceU) return 'left';
  if (u >= 1 - toleranceU) return 'right';
  return null;
}

/** Mesh overlay state (pure data; `render/overlays.ts` only draws it) */
export interface MeshGridState {
  cols: number;
  rows: number;
  /** Row-major control points (including warp offset) */
  points: { x: number; y: number }[];
  /** Control-point positions when undeformed (for reference lines) */
  basePoints: { x: number; y: number }[];
}

/** Derive the overlay state from the mesh and the layer box */
export function meshGridState(mesh: MeshWarp, box: LayerBox, rotated = true): MeshGridState {
  const controls = meshControlPoints(mesh, box, rotated);
  return {
    cols: mesh.cols,
    rows: mesh.rows,
    points: controls.map((point) => ({ x: point.x, y: point.y })),
    basePoints: controls.map((point) => ({ x: point.baseX, y: point.baseY })),
  };
}

export interface TransformOverlay {
  /** Regular transform box (free transform mode) */
  transformBox: LayerBox | null;
  /** Mesh control points (perspective / distort / skew / warp modes) */
  meshGrid: MeshGridState | null;
}

/**
 * What the overlay shows is decided solely by "layer + transform mode".
 *
 * Lives in core because canvas and interaction both need it; two copies drift (drag box ≠ idle box).
 */
export function transformOverlayFor(
  layer: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    locked?: boolean;
    mesh?: MeshWarp | null;
  },
  mode: TransformMode,
): TransformOverlay {
  if (layer.locked) return { transformBox: null, meshGrid: null };
  const box: LayerBox = {
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    rotation: layer.rotation,
  };
  if (mode === 'free' || meshIsIdentity(layer.mesh)) return { transformBox: box, meshGrid: null };
  return { transformBox: null, meshGrid: meshGridState(layer.mesh as MeshWarp, box, true) };
}

/* ------------------------------ Transform again ------------------------------ */

/** One transform's delta: ⌘⇧T "transform again" simply applies it once more */
export interface TransformDelta {
  dx: number;
  dy: number;
  scaleX: number;
  scaleY: number;
  /** Angle delta */
  rotation: number;
}

export function isIdentityDelta(delta: TransformDelta): boolean {
  return (
    Math.abs(delta.dx) < 0.5 &&
    Math.abs(delta.dy) < 0.5 &&
    Math.abs(delta.scaleX - 1) < 1e-4 &&
    Math.abs(delta.scaleY - 1) < 1e-4 &&
    Math.abs(delta.rotation) < 0.01
  );
}

/**
 * Apply the delta to the layer box: scale about the box center, then add translation and rotation.
 *
 * The mesh warp needs no extra work: offsets are normalized and scale / rotate / translate with the box.
 */
export function applyTransformDelta(box: LayerBox, delta: TransformDelta): LayerBox {
  const width = Math.max(MIN_TRANSFORM_SIZE, box.width * delta.scaleX);
  const height = Math.max(MIN_TRANSFORM_SIZE, box.height * delta.scaleY);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  return {
    x: centerX - width / 2 + delta.dx,
    y: centerY - height / 2 + delta.dy,
    width,
    height,
    rotation: box.rotation + delta.rotation,
  };
}

/* ------------------------------ Text layout / warp ------------------------------ */

/**
 * Optional fonts (proper nouns, shown as-is, never translated).
 *
 * Lives in core, not a panel: the character and properties panels both need it; two copies always drift apart.
 */
export const FONT_FAMILIES = [
  'PingFang SC',
  'Microsoft YaHei',
  'Noto Serif SC',
  'Helvetica',
  'Arial',
  'Georgia',
  'Courier New',
].map((name) => ({ id: name, label: name }));

/** All warp styles (including none) */
export const TEXT_WARP_KINDS: TextWarpKind[] = [
  'none',
  'arc',
  'arcLower',
  'arcUpper',
  'arch',
  'shellLower',
  'shellUpper',
  'wave',
  'flag',
  'rise',
  'fisheye',
];

/** Warp strength cap (percent) */
export const MAX_WARP_AMOUNT = 100;

export function clampWarpAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(MAX_WARP_AMOUNT, Math.max(-MAX_WARP_AMOUNT, value)));
}

/** Bend strength → max vertical shift as a fraction of the text block height (25%: clear but stays on canvas) */
const WARP_BEND_RATIO = 0.25;
/** Horizontal strength → max horizontal shift as a fraction of the text block width */
const WARP_HORIZONTAL_RATIO = 0.18;

export interface WarpOffset {
  /** Horizontal offset, as a fraction of the text block width */
  dx: number;
  /** Vertical offset, as a fraction of the text block height (negative = up) */
  dy: number;
}

/**
 * Warp displacement field (pure function, shared by rendering and tests).
 *
 * `u` ∈ [0,1] is the horizontal normalized coordinate (left→right) and `v` ∈ [0,1] the vertical (top→bottom);
 * the return value is a **normalized offset** (multiply by width / height for pixels). Photoshop's styles:
 * arc variants bend along the baseline, `lower/upper` bend only the bottom / top half, `arch` bulges in the middle,
 * `wave` is S-shaped, `flag` flutters (amplitude grows with height), `rise` lifts diagonally, `fisheye` bulges radially.
 */
export function warpOffset(
  kind: TextWarpKind,
  u: number,
  v: number,
  bend: number,
  horizontal: number,
): WarpOffset {
  if (kind === 'none') return { dx: 0, dy: 0 };
  const bendAmount = clampWarpAmount(bend) / MAX_WARP_AMOUNT;
  const horizontalAmount = clampWarpAmount(horizontal) / MAX_WARP_AMOUNT;
  const mid = Math.sin(Math.PI * u);
  /** Distance from the horizontal center line: 0 = center, 1 = top / bottom edge */
  const center = Math.abs(v * 2 - 1);
  let dx = 0;
  let dy = 0;
  switch (kind) {
    case 'arc':
      dy = -mid;
      break;
    case 'arcLower':
      dy = -mid * v;
      break;
    case 'arcUpper':
      dy = -mid * (1 - v);
      break;
    case 'arch':
      dy = -mid * (1 - center);
      break;
    case 'shellLower':
      dy = -mid * (1 + v) * 0.5;
      break;
    case 'shellUpper':
      dy = -mid * (2 - v) * 0.5;
      break;
    case 'wave':
      dy = Math.sin(Math.PI * 2 * u);
      break;
    case 'flag':
      dy = Math.sin(Math.PI * 2 * u) * (0.5 + 0.5 * v);
      break;
    case 'rise':
      // Lift the right side as a whole (upward when bend > 0)
      dy = -u;
      break;
    case 'fisheye': {
      // Radial bulge: center stays put, offset grows toward the edges (bend = vertical, horizontal = lateral)
      const radial = Math.min(1, Math.hypot(u - 0.5, v - 0.5) / 0.7071);
      dx = (u - 0.5) * 2 * radial;
      dy = (v - 0.5) * 2 * radial;
      break;
    }
  }
  return {
    dx: dx * horizontalAmount * WARP_HORIZONTAL_RATIO,
    dy: dy * bendAmount * WARP_BEND_RATIO,
  };
}

/**
 * Whether text must go through the bitmap rendering path.
 *
 * Two cases Konva.Text cannot express: warp (needs mesh resampling) and paragraph spacing (needs per-line layout).
 * `render/text.ts` draws that path from the **same code** as the Canvas2D export, so preview and export agree.
 */
export function needsTextBitmap(layer: {
  paragraphSpacing: number;
  warp: { kind: string; bend: number; horizontal: number };
}): boolean {
  if (layer.paragraphSpacing > 0) return true;
  if (layer.warp.kind === 'none') return false;
  return layer.warp.bend !== 0 || layer.warp.horizontal !== 0;
}

/* ------------------------------ Vector mask / clipping mask ------------------------------ */

/** Feather cap: same as the pixel mask (`render/mask.ts` caps blur at 64px) */
export const MAX_VECTOR_FEATHER = 64;
/** Outline cap: boolean ops can pile up outlines, so truncate to keep masks and project files sane */
export const MAX_VECTOR_CONTOURS = 32;

/** Vector mask signature: outline points plus feather / invert all feed the cache key */
export function vectorMaskSignature(mask: VectorMaskRef | null | undefined): string {
  if (!mask?.enabled || mask.contours.length === 0) return '';
  const parts = mask.contours.map(
    (contour) => `${contour.add ? '+' : '-'}${contour.path.map((n) => Math.round(n)).join(',')}`,
  );
  return `${mask.inverted ? 'i' : ''}${mask.feather.toFixed(1)}|${parts.join(';')}`;
}

/** Whether this mask actually clips (enabled and at least one outline) */
export function hasVectorMask(mask: VectorMaskRef | null | undefined): boolean {
  return Boolean(mask?.enabled) && (mask?.contours.length ?? 0) > 0;
}

/**
 * Selection → vector mask outlines (layer-local coordinates).
 * Just shift the selection's union / difference outlines by `-(originX, originY)`; the semantics carry over,
 * so adds / subtracts / holes from boolean ops all become multiple mask outlines unchanged.
 */
export function selectionToVectorContours(
  selection: Selection,
  originX: number,
  originY: number,
): SelectionPart[] {
  const contours: SelectionPart[] = [];
  for (const contour of selectionContours(selection)) {
    if (contour.path.length < 6) continue;
    const path = new Array<number>(contour.path.length);
    for (let i = 0; i < contour.path.length; i += 2) {
      path[i] = contour.path[i] - originX;
      path[i + 1] = contour.path[i + 1] - originY;
    }
    contours.push({ path, add: contour.add });
  }
  return contours;
}

/**
 * Base layer index for a clipping mask: the nearest drawable layer below it at the same level.
 *
 * Cases that cannot be a base:
 * - adjustment layers (produce no pixels, and PS forbids it too);
 * - pass-through groups (never composited into one image, so no usable alpha);
 * - hidden layers (in PS the whole clip dies when the base is hidden).
 * Returns -1 when none is found, and the caller then ignores `clipped`.
 */
export function clipBaseIndex(layers: Layer[], index: number): number {
  for (let i = index - 1; i >= 0; i -= 1) {
    const candidate = layers[i];
    if (!candidate) continue;
    // Stop at the group boundary: a clipping mask only affects layers below it in the same group
    if ((candidate.parentId ?? null) !== (layers[index]?.parentId ?? null)) return -1;
    if (!candidate.visible) continue;
    if (candidate.kind === 'adjustment') continue;
    if (candidate.kind === 'group' && candidate.passThrough) continue;
    if (candidate.clipped) continue;
    return i;
  }
  return -1;
}

/* ------------------------------ Layer styles ------------------------------ */

/** Effect ids (same names as the `LayerStyle` fields) */
export const STYLE_EFFECTS = [
  'dropShadow',
  'innerShadow',
  'outerGlow',
  'stroke',
  'colorOverlay',
] as const;
export type StyleEffectId = (typeof STYLE_EFFECTS)[number];

export const MAX_EFFECT_SIZE = 250;
export const MAX_EFFECT_DISTANCE = 500;
export const MAX_EFFECT_SPREAD = 100;

export function createDropShadow(): DropShadowStyle {
  return {
    enabled: true,
    color: '#000000',
    opacity: 0.6,
    angle: 135,
    distance: 6,
    spread: 0,
    size: 8,
  };
}

export function createInnerShadow(): InnerShadowStyle {
  return { enabled: true, color: '#000000', opacity: 0.5, angle: 135, distance: 4, size: 6 };
}

export function createOuterGlow(): OuterGlowStyle {
  return { enabled: true, color: '#FACC15', opacity: 0.75, size: 12 };
}

export function createStroke(): StrokeStyle {
  return { enabled: true, color: '#FFFFFF', opacity: 1, size: 3, position: 'outside' };
}

export function createColorOverlay(): ColorOverlayStyle {
  return { enabled: true, color: '#2563EB', opacity: 0.65 };
}

/** Default style (all five effects off): the starting point for "add effect" in the panel */
export function createLayerStyle(): LayerStyle {
  return {
    dropShadow: { ...createDropShadow(), enabled: false },
    innerShadow: { ...createInnerShadow(), enabled: false },
    outerGlow: { ...createOuterGlow(), enabled: false },
    stroke: { ...createStroke(), enabled: false },
    colorOverlay: { ...createColorOverlay(), enabled: false },
  };
}

/** Whether this effect draws anything visible */
export function isEffectActive(effect: { enabled: boolean } | null | undefined): boolean {
  return Boolean(effect?.enabled);
}

/** Whether any effect in the layer style is enabled */
export function hasLayerStyle(style: LayerStyle | null | undefined): boolean {
  if (!style) return false;
  return STYLE_EFFECTS.some((id) => isEffectActive(style[id]));
}

/**
 * How much padding a style needs outside its own outline (px).
 *
 * Basis: Canvas2D's `filter: blur(r)` reaches about 2r, and `spread` / `distance` shift and grow it directly;
 * inner shadow and inner stroke stay inside the silhouette and take no padding.
 */
export function stylePadding(style: LayerStyle | null | undefined): number {
  if (!style) return 0;
  let pad = 0;
  const shadow = style.dropShadow;
  if (isEffectActive(shadow) && shadow) {
    pad = Math.max(pad, shadow.size * 2 + shadow.spread + Math.abs(shadow.distance));
  }
  const glow = style.outerGlow;
  if (isEffectActive(glow) && glow) pad = Math.max(pad, glow.size * 2);
  const stroke = style.stroke;
  if (isEffectActive(stroke) && stroke && stroke.position === 'outside') {
    pad = Math.max(pad, stroke.size);
  }
  return Math.ceil(pad);
}

/** Style signature: feeds the bake / composite cache keys, so any changed parameter changes the key */
export function styleSignature(style: LayerStyle | null | undefined): string {
  if (!hasLayerStyle(style)) return '';
  const parts: string[] = [];
  for (const id of STYLE_EFFECTS) {
    const effect = style?.[id];
    if (!isEffectActive(effect) || !effect) continue;
    parts.push(
      Object.entries(effect)
        .map(([key, value]) => `${key}=${typeof value === 'number' ? value.toFixed(2) : value}`)
        .join(','),
    );
  }
  return parts.join('|');
}

/* ------------------------------ Gradients / retouch ------------------------------ */

export type GradientKind = 'linear' | 'radial';
/** Gradient endpoint pairs: foreground→transparent / foreground→background */
export type GradientMode = 'fg-transparent' | 'fg-bg';

export const GRADIENT_KINDS: GradientKind[] = ['linear', 'radial'];
export const GRADIENT_MODES: GradientMode[] = ['fg-transparent', 'fg-bg'];

export type RetouchMode = 'dodge' | 'burn' | 'sponge';
export const RETOUCH_MODES: RetouchMode[] = ['dodge', 'burn', 'sponge'];

/** Retouch tool strength cap (percent) */
export const MAX_RETOUCH_STRENGTH = 100;

export interface HsvColor {
  /** Hue 0~360 */
  h: number;
  /** Saturation 0~100 */
  s: number;
  /** Lightness 0~100 */
  v: number;
}

/** `#RRGGBB` → HSV; falls back to black when parsing fails */
export function hexToHsv(hex: string): HsvColor {
  const value = String(hex).trim().replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return { h: 0, s: 0, v: 0 };
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 1e-6) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max <= 0 ? 0 : (delta / max) * 100, v: max * 100 };
}

/** HSV → `#RRGGBB` (uppercase, so it compares against existing color strings) */
export function hsvToHex(hsv: HsvColor): string {
  const h = ((hsv.h % 360) + 360) % 360;
  const s = Math.min(100, Math.max(0, hsv.s)) / 100;
  const v = Math.min(100, Math.max(0, hsv.v)) / 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const segment = Math.floor(h / 60) % 6;
  const rgb: [number, number, number] =
    segment === 0
      ? [c, x, 0]
      : segment === 1
        ? [x, c, 0]
        : segment === 2
          ? [0, c, x]
          : segment === 3
            ? [0, x, c]
            : segment === 4
              ? [x, 0, c]
              : [c, 0, x];
  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`.toUpperCase();
}

/** `#RRGGBB` + alpha → `rgba(...)`; falls back to black when parsing fails */
export function withAlpha(hex: string, alpha: number): string {
  const value = String(hex).trim().replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;
  const a = Math.min(1, Math.max(0, Number.isFinite(alpha) ? alpha : 1));
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(0,0,0,${a})`;
  return `rgba(${parseInt(full.slice(0, 2), 16)},${parseInt(full.slice(2, 4), 16)},${parseInt(
    full.slice(4, 6),
    16,
  )},${a})`;
}

/** Panel sliders are integers: percent / degrees */
export function clampPercent(value: number, min = -100, max = 100): number {
  return Math.round(clampNumber(value, min, max));
}

/** 0~1 opacity, shown on sliders as 0~100 */
export function clampUnit(value: number): number {
  return Math.round(clampNumber(value, 0, 1) * 100) / 100;
}

/**
 * Adjustment parameters → CSS filter string (only the parts CSS can express).
 * Temperature, sharpen and the like cannot be expressed in CSS and go through `render/filters.ts` pixels.
 */
export function buildFilterString(adjustments: Adjustments): string {
  const parts: string[] = [];
  const brightness = 1 + adjustments.brightness / 100 + adjustments.exposure / 140;
  if (Math.abs(brightness - 1) > 0.001) parts.push(`brightness(${round(brightness)})`);
  if (adjustments.contrast !== 0) {
    parts.push(`contrast(${round(1 + adjustments.contrast / 100)})`);
  }
  if (adjustments.saturation !== 0) {
    parts.push(`saturate(${round(1 + adjustments.saturation / 100)})`);
  }
  if (adjustments.hue !== 0) parts.push(`hue-rotate(${adjustments.hue}deg)`);
  return parts.join(' ');
}

/** Whether any extended adjustment is on (levels, curves, color balance, B&W, threshold, gradient map, desaturate) */
export function hasExtendedAdjustments(adjustments: Adjustments): boolean {
  return Boolean(
    adjustments.levels ||
    adjustments.curves ||
    adjustments.colorBalance ||
    adjustments.blackWhite ||
    (adjustments.threshold !== null && adjustments.threshold !== undefined) ||
    adjustments.gradientMap ||
    adjustments.desaturate ||
    adjustments.photoFilter ||
    adjustments.channelMixer ||
    adjustments.shadowsHighlights ||
    adjustments.selectiveColor ||
    adjustments.replaceColor,
  );
}

/** Whether any adjustment needs pixel math (decides whether the getImageData channel is required) */
export function needsPixelPass(adjustments: Adjustments, filters: FilterSpec[]): boolean {
  if (adjustments.temperature !== 0) return true;
  if (adjustments.sharpen > 0) return true;
  if (hasExtendedAdjustments(adjustments)) return true;
  return activeFilters(filters).some((spec) => !isCssFilter(spec.id));
}

/**
 * Enabled filters (`enabled === false` means "keep the parameters but switch it off for now").
 *
 * Every **render** path must go through it, while the cache signature (`filterSpecKey`) still serializes the
 * full list, so disabling a filter both changes the image and invalidates the cache.
 */
export function activeFilters(filters: FilterSpec[] | null | undefined): FilterSpec[] {
  if (!filters || filters.length === 0) return [];
  return filters.filter((spec) => spec.enabled !== false);
}

/** Whether the smart filter changes the image (decides whether a smart object can use the light preview path) */
export function hasActiveFilters(filters: FilterSpec[] | null | undefined): boolean {
  return activeFilters(filters).length > 0;
}

/**
 * The "no adjustments" adjustment parameters.
 * For callers that only care about the filter stack (smart filter baking, signatures), without relying on `model/factory`.
 */
export const NO_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  temperature: 0,
  exposure: 0,
  sharpen: 0,
};

/** Stable serialization of a filter instance (parameters sorted by key, so key order can't shift the signature) */
function filterSpecKey(filters: FilterSpec[]): string {
  return filters
    .map((spec) => {
      const params = spec.params
        ? Object.keys(spec.params)
            .sort()
            .map((key) => `${key}=${spec.params?.[key]}`)
            .join(',')
        : '';
      // `enabled` is part of the signature: toggling it must invalidate the cache
      return `${spec.id}(${params})${spec.enabled === false ? ':off' : ''}`;
    })
    .join('|');
}

/** Bake cache signature: reuse the last canvas while the parameters are unchanged */
export function bakeSignature(
  assetId: string,
  rev: number,
  adjustments: Adjustments,
  filters: FilterSpec[],
): string {
  return [assetId, rev, JSON.stringify(adjustments ?? {}), filterSpecKey(filters ?? [])].join('|');
}

/* ------------------------------ Adjustment LUTs ------------------------------ */

/** Clamp to 0~255 */
function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
}

function identityLut(): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) lut[i] = i;
  return lut;
}

/** Levels LUT */
export function buildLevelsLut(params: LevelsParams): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  const inBlack = clampByte(params.inBlack);
  const inWhite = clampByte(params.inWhite);
  const range = Math.max(1, inWhite - inBlack);
  const gamma = Math.min(10, Math.max(0.05, params.gamma || 1));
  const outBlack = clampByte(params.outBlack);
  const outWhite = clampByte(params.outWhite);
  for (let i = 0; i < 256; i += 1) {
    let value = (i - inBlack) / range;
    value = value <= 0 ? 0 : value >= 1 ? 1 : value;
    value = Math.pow(value, 1 / gamma);
    lut[i] = outBlack + value * (outWhite - outBlack);
  }
  return lut;
}

/**
 * Curve LUT: control points are sorted by x, then **monotone cubic interpolation (PCHIP)** is applied, which
 * unlike a plain cubic spline does not overshoot between points, keeping color grading predictable.
 */
export function buildCurveLut(points: CurvePoint[]): Uint8ClampedArray {
  const sorted = [...points]
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.x - b.x);
  if (sorted.length === 0) return identityLut();
  if (sorted.length === 1) {
    const lut = new Uint8ClampedArray(256);
    lut.fill(clampByte(sorted[0].y));
    return lut;
  }

  const count = sorted.length;
  const h: number[] = [];
  const delta: number[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    const step = Math.max(1e-6, sorted[i + 1].x - sorted[i].x);
    h.push(step);
    delta.push((sorted[i + 1].y - sorted[i].y) / step);
  }
  const slope: number[] = new Array(count).fill(0);
  slope[0] = delta[0];
  slope[count - 1] = delta[count - 2];
  for (let i = 1; i < count - 1; i += 1) {
    if (delta[i - 1] * delta[i] <= 0) {
      slope[i] = 0;
    } else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      slope[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
    }
  }

  const lut = new Uint8ClampedArray(256);
  for (let x = 0; x < 256; x += 1) {
    if (x <= sorted[0].x) {
      lut[x] = clampByte(sorted[0].y);
      continue;
    }
    if (x >= sorted[count - 1].x) {
      lut[x] = clampByte(sorted[count - 1].y);
      continue;
    }
    let i = 0;
    while (i < count - 2 && x > sorted[i + 1].x) i += 1;
    const t = (x - sorted[i].x) / h[i];
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    lut[x] =
      h00 * sorted[i].y + h10 * h[i] * slope[i] + h01 * sorted[i + 1].y + h11 * h[i] * slope[i + 1];
  }
  return lut;
}

/** Concatenate two LUTs: a first, then b */
export function composeLut(a: Uint8ClampedArray, b: Uint8ClampedArray): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) lut[i] = b[a[i]];
  return lut;
}

/**
 * Fold levels + curves into one LUT per channel (the separable part).
 * Color balance / B&W / threshold / gradient map rely on luminance or cross-channel data, so they stay out of
 * LUTs; `render/adjust.ts` handles them per pixel. A null return means there is nothing separable.
 */
export function buildAdjustLuts(
  adjustments: Adjustments,
): { r: Uint8ClampedArray; g: Uint8ClampedArray; b: Uint8ClampedArray } | null {
  const levelsLut = adjustments.levels ? buildLevelsLut(adjustments.levels) : null;
  const curves = adjustments.curves;
  const rgbLut = curves?.rgb?.length ? buildCurveLut(curves.rgb) : null;
  const redLut = curves?.red?.length ? buildCurveLut(curves.red) : null;
  const greenLut = curves?.green?.length ? buildCurveLut(curves.green) : null;
  const blueLut = curves?.blue?.length ? buildCurveLut(curves.blue) : null;
  if (!levelsLut && !rgbLut && !redLut && !greenLut && !blueLut) return null;

  const chain = (extra: Uint8ClampedArray | null): Uint8ClampedArray => {
    let lut = levelsLut ? Uint8ClampedArray.from(levelsLut) : null;
    if (rgbLut) lut = lut ? composeLut(lut, rgbLut) : Uint8ClampedArray.from(rgbLut);
    if (extra) lut = lut ? composeLut(lut, extra) : Uint8ClampedArray.from(extra);
    return lut ?? identityLut();
  };

  return { r: chain(redLut), g: chain(greenLut), b: chain(blueLut) };
}

/** Default levels parameters */
export function defaultLevels(): LevelsParams {
  return { inBlack: 0, inWhite: 255, gamma: 1, outBlack: 0, outWhite: 255 };
}

/** Fixed x positions used by the curve editor (0 / 64 / 128 / 192 / 255) */
export const CURVE_X = [0, 64, 128, 192, 255];

/** Align any curve point set to those fixed x positions: missing points fill the diagonal (no change) */
export function curvePointsFrom(points: CurvePoint[] | null | undefined): CurvePoint[] {
  const source = points && points.length >= 2 ? points : null;
  return CURVE_X.map((x) => {
    const existing = source?.find((point) => Math.abs(point.x - x) < 1);
    return { x, y: existing ? existing.y : x };
  });
}

/** Default curve (two-point line = identity) */
export function defaultCurves(): CurvesParams {
  return {
    rgb: [
      { x: 0, y: 0 },
      { x: 255, y: 255 },
    ],
    red: null,
    green: null,
    blue: null,
  };
}

export function defaultColorBalance(): ColorBalanceParams {
  return { shadows: [0, 0, 0], midtones: [0, 0, 0], highlights: [0, 0, 0] };
}

export function defaultBlackWhite(): BlackWhiteParams {
  return { red: 40, yellow: 60, green: 40, cyan: 60, blue: 20, magenta: 80 };
}

/* --------------------------- More adjustments (P1-C2) --------------------------- */

/** Photo filter default: warm (an approximation of PS's "warming filter 85") */
export function defaultPhotoFilter(): PhotoFilterParams {
  return { color: '#EC8A00', density: 25, preserveLuminosity: true };
}

/** Channel mixer default: identity (each output channel takes only its own source) */
export function defaultChannelMixer(): ChannelMixerParams {
  return {
    red: [100, 0, 0, 0],
    green: [0, 100, 0, 0],
    blue: [0, 0, 100, 0],
  };
}

export function defaultShadowsHighlights(): ShadowsHighlightsParams {
  return { shadows: 35, highlights: 0 };
}

export function defaultReplaceColor(): ReplaceColorParams {
  return { color: '#FF0000', hue: 0, saturation: 0, lightness: 0, fuzziness: 60 };
}

/** The 9 selective-color ranges (in panel display order) */
export const SELECTIVE_RANGES: readonly SelectiveRange[] = [
  'reds',
  'yellows',
  'greens',
  'cyans',
  'blues',
  'magentas',
  'whites',
  'neutrals',
  'blacks',
];

/** All-zero selective color parameters (the starting point when enabled in the panel) */
export function defaultSelectiveColor(): SelectiveColorParams {
  const ranges = {} as Record<SelectiveRange, number[]>;
  for (const range of SELECTIVE_RANGES) ranges[range] = [0, 0, 0, 0];
  return { ranges };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/* ------------------------------ Viewport scrolling / zoom ------------------------------ */

/** Zoom limits: wheel zoom and the store share one clamp instead of each writing its own */
export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 8;

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(scale * 1000) / 1000));
}

/** Overscroll margin (screen px): leaves scrollable slack around the canvas instead of pinning it to the edge */
export const OVERSCROLL_SCREEN = 160;

export interface ScrollMetrics {
  /** Viewport size (document units = screen px / scale) */
  viewW: number;
  viewH: number;
  /** Scrollable world (document rect + overscroll, at least viewport-sized) in document coordinates */
  worldLeft: number;
  worldTop: number;
  worldW: number;
  worldH: number;
  /** Top-left of the current viewport in world space (already clamped) */
  left: number;
  top: number;
  /** Scroll range (world size − viewport size, ≥ 0) */
  rangeX: number;
  rangeY: number;
}

/**
 * Scroll geometry: turn "document + viewport" into the numbers a scrollbar needs.
 * The world is the document rect plus `overscroll` (screen px) on each side, at least as large as the viewport,
 * so the range is 0 when the document is smaller (no scrollbars) and "center" lands inside the valid range.
 */
export function scrollMetrics(
  doc: { width: number; height: number },
  viewport: { width: number; height: number; scale: number; x: number; y: number },
  overscroll = OVERSCROLL_SCREEN,
  rotation = 0,
): ScrollMetrics {
  const scale = viewport.scale > 0 ? viewport.scale : 1;
  const viewW = Math.max(1, viewport.width) / scale;
  const viewH = Math.max(1, viewport.height) / scale;
  const pad = overscroll / scale;
  // With a rotated view the scrollable world must grow by the bounds, or the canvas stays clamped and won't scroll
  const bounds = rotatedDocBounds(doc, rotation);
  const worldW = Math.max(bounds.width + pad * 2, viewW);
  const worldH = Math.max(bounds.height + pad * 2, viewH);
  const worldLeft = (doc.width - worldW) / 2;
  const worldTop = (doc.height - worldH) / 2;
  const rangeX = Math.max(0, worldW - viewW);
  const rangeY = Math.max(0, worldH - viewH);
  return {
    viewW,
    viewH,
    worldLeft,
    worldTop,
    worldW,
    worldH,
    left: clampNumber(-viewport.x / scale, worldLeft, worldLeft + rangeX),
    top: clampNumber(-viewport.y / scale, worldTop, worldTop + rangeY),
    rangeX,
    rangeY,
  };
}

/** World coordinates (viewport top-left) → screen translation */
export function viewportFromScroll(
  left: number,
  top: number,
  scale: number,
): { x: number; y: number } {
  const safe = scale > 0 ? scale : 1;
  return { x: Math.round(-left * safe), y: Math.round(-top * safe) };
}

/** Clamp a candidate viewport into the scrollable world (shared by wheel scrolling and hand panning) */
export function clampViewport(
  viewport: { x: number; y: number; scale: number },
  doc: { width: number; height: number },
  size: { width: number; height: number },
  overscroll = OVERSCROLL_SCREEN,
  rotation = 0,
): { x: number; y: number } {
  const metrics = scrollMetrics(doc, { ...size, ...viewport }, overscroll, rotation);
  return viewportFromScroll(metrics.left, metrics.top, viewport.scale);
}

/** Zoom about a point: keep the document coordinate under it fixed (shared by wheel zoom) */
export function zoomAtPoint(
  viewport: { x: number; y: number; scale: number },
  nextScale: number,
  anchor: { x: number; y: number },
  size?: { width: number; height: number },
  rotation = 0,
): { x: number; y: number; scale: number } {
  const scale = viewport.scale > 0 ? viewport.scale : 1;
  const target = clampScale(nextScale);
  // Rotated view: invert the anchor's document position first, then solve the new pan with the forward transform
  if (size && rotation) {
    const p = screenToDoc(anchor, viewport, size, rotation);
    const center = viewCenter(size);
    const local = rotate(anchor.x - center.x, anchor.y - center.y, (-rotation * Math.PI) / 180);
    return {
      scale: target,
      x: Math.round(center.x + local.x - p.x * target),
      y: Math.round(center.y + local.y - p.y * target),
    };
  }
  const docX = (anchor.x - viewport.x) / scale;
  const docY = (anchor.y - viewport.y) / scale;
  return {
    scale: target,
    x: Math.round(anchor.x - docX * target),
    y: Math.round(anchor.y - docY * target),
  };
}

/** Fit zoom: leave padding and never exceed 1 (small images are not upscaled, avoiding blur) */
export function computeFitScale(
  doc: Pick<PhotoDoc, 'width' | 'height'>,
  viewport: { width: number; height: number },
  padding = 32,
  rotation = 0,
): number {
  const available = {
    width: Math.max(1, viewport.width - padding * 2),
    height: Math.max(1, viewport.height - padding * 2),
  };
  if (doc.width <= 0 || doc.height <= 0) return 1;
  // After rotation, fit by bounds: raw width/height would push the rotated canvas past the viewport
  const bounds = rotatedDocBounds(doc, rotation);
  const scale = Math.min(available.width / bounds.width, available.height / bounds.height);
  return Math.max(0.02, Math.min(1, Math.round(scale * 1000) / 1000));
}

export function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function clampRect(rect: Rect, bounds: { width: number; height: number }): Rect {
  const x = clampNumber(rect.x, 0, bounds.width);
  const y = clampNumber(rect.y, 0, bounds.height);
  return {
    x,
    y,
    width: clampNumber(rect.width, 0, bounds.width - x),
    height: clampNumber(rect.height, 0, bounds.height - y),
  };
}

/* ------------------------------ Free-transform geometry ------------------------------ */

/** Transform handles: 8 scale handles + 1 rotate handle */
export type TransformHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

/** Transform box: position / size + rotation (degrees, about the center) */
export interface LayerBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/** Minimum scale (document px): keeps a box from collapsing to 0 and becoming undraggable */
export const MIN_TRANSFORM_SIZE = 8;

const HANDLE_LOCAL: { id: Exclude<TransformHandle, 'rotate'>; lx: number; ly: number }[] = [
  { id: 'nw', lx: -1, ly: -1 },
  { id: 'n', lx: 0, ly: -1 },
  { id: 'ne', lx: 1, ly: -1 },
  { id: 'e', lx: 1, ly: 0 },
  { id: 'se', lx: 1, ly: 1 },
  { id: 's', lx: 0, ly: 1 },
  { id: 'sw', lx: -1, ly: 1 },
  { id: 'w', lx: -1, ly: 0 },
];

function boxCenter(box: LayerBox): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Layer box control points (document coords). `rotateOffset`: the rotate handle's screen gap above the top edge, in doc units */
export function transformHandles(
  box: LayerBox,
  rotateOffset = 0,
): { id: TransformHandle; x: number; y: number }[] {
  const center = boxCenter(box);
  const rad = (box.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = box.width / 2;
  const hh = box.height / 2;
  const toDoc = (lx: number, ly: number) => ({
    x: center.x + lx * cos - ly * sin,
    y: center.y + lx * sin + ly * cos,
  });
  const out = HANDLE_LOCAL.map((h) => ({
    id: h.id as TransformHandle,
    ...toDoc(h.lx * hw, h.ly * hh),
  }));
  out.push({ id: 'rotate', ...toDoc(0, -hh - rotateOffset) });
  return out;
}

/** Document coordinates → layer-local coordinates (origin at the layer center, unrotated) */
export function toLocalPoint(box: LayerBox, px: number, py: number): { x: number; y: number } {
  const center = boxCenter(box);
  const rad = (-box.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - center.x;
  const dy = py - center.y;
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

/**
 * New box after dragging a handle.
 * - `local` is the pointer position in the local frame of the "initial box";
 * - `keepRatio` (Shift) keeps the aspect ratio, `fromCenter` (Alt) scales symmetrically about the center.
 */
export function resizeLayerBox(
  start: LayerBox,
  handle: Exclude<TransformHandle, 'rotate'>,
  local: { x: number; y: number },
  options: { keepRatio?: boolean; fromCenter?: boolean } = {},
): LayerBox {
  const min = MIN_TRANSFORM_SIZE;
  const hw = start.width / 2;
  const hh = start.height / 2;

  let left = -hw;
  let right = hw;
  let top = -hh;
  let bottom = hh;

  const hasW = handle.includes('w');
  const hasE = handle.includes('e');
  const hasN = handle.includes('n');
  const hasS = handle.includes('s');

  if (options.fromCenter) {
    // Center anchor: dragging one side mirrors the opposite side
    const dx = Math.abs(local.x);
    const dy = Math.abs(local.y);
    if (hasW || hasE) {
      const half = Math.max(min / 2, dx);
      left = -half;
      right = half;
    }
    if (hasN || hasS) {
      const half = Math.max(min / 2, dy);
      top = -half;
      bottom = half;
    }
  } else {
    if (hasW) left = Math.min(local.x, right - min);
    if (hasE) right = Math.max(local.x, left + min);
    if (hasN) top = Math.min(local.y, bottom - min);
    if (hasS) bottom = Math.max(local.y, top + min);
  }

  let width = right - left;
  let height = bottom - top;

  if (options.keepRatio && start.width > 0 && start.height > 0) {
    const ratio = start.width / start.height;
    // Corner handles scale by the largest side; edge handles scale only along their own axis
    const isCorner = (hasW || hasE) && (hasN || hasS);
    if (isCorner) {
      const scale = Math.max(width / start.width, height / start.height);
      width = start.width * scale;
      height = start.height * scale;
    } else if (hasW || hasE) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }
    // After proportional scaling, snap the edges back around the anchor
    if (options.fromCenter) {
      left = -width / 2;
      right = width / 2;
      top = -height / 2;
      bottom = height / 2;
    } else {
      if (hasW) left = right - width;
      else right = left + width;
      if (hasN) top = bottom - height;
      else bottom = top + height;
    }
  }

  const center = boxCenter(start);
  const rad = (start.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const localCx = (left + right) / 2;
  const localCy = (top + bottom) / 2;
  const newCenterX = center.x + localCx * cos - localCy * sin;
  const newCenterY = center.y + localCx * sin + localCy * cos;
  const w = Math.max(1, right - left);
  const h = Math.max(1, bottom - top);

  return {
    x: Math.round(newCenterX - w / 2),
    y: Math.round(newCenterY - h / 2),
    width: Math.round(w),
    height: Math.round(h),
    rotation: start.rotation,
  };
}

/** Drag the rotate handle: `deltaDeg` is the pointer's change from the start angle; `snap` sticks to 15° */
export function rotateLayerBox(start: LayerBox, deltaDeg: number, snap = false): LayerBox {
  let rotation = start.rotation + deltaDeg;
  if (snap) rotation = Math.round(rotation / 15) * 15;
  rotation = ((((rotation + 180) % 360) + 360) % 360) - 180;
  return { ...start, rotation: Math.round(rotation * 10) / 10 };
}

/** Angle of the pointer relative to the layer center (degrees, same direction on screen and document) */
export function angleFromCenter(box: LayerBox, px: number, py: number): number {
  const center = boxCenter(box);
  return (Math.atan2(py - center.y, px - center.x) * 180) / Math.PI;
}

/** Hit test: a handle (`radius` is the hit radius in document units) or the inside of the box */
export function hitTransformHandle(
  box: LayerBox,
  px: number,
  py: number,
  radius: number,
  rotateOffset = 0,
): TransformHandle | 'inside' | null {
  const handles = transformHandles(box, rotateOffset);
  let best: { id: TransformHandle; distance: number } | null = null;
  for (const handle of handles) {
    const distance = Math.hypot(handle.x - px, handle.y - py);
    if (distance <= radius && (!best || distance < best.distance)) {
      best = { id: handle.id, distance };
    }
  }
  if (best) return best.id;
  const local = toLocalPoint(box, px, py);
  if (Math.abs(local.x) <= box.width / 2 && Math.abs(local.y) <= box.height / 2) return 'inside';
  return null;
}

export function intersectRect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

/** Write selection outlines into the current path (document coords): shared entry for rect / oval / lasso */
/** Signed polygon area (shoelace): with y pointing down, clockwise is positive */
export function signedArea(path: number[]): number {
  let area = 0;
  for (let i = 0, j = path.length - 2; i < path.length; j = i, i += 2) {
    area += path[j] * path[i + 1] - path[i] * path[j + 1];
  }
  return area / 2;
}

/** Normalize outline direction to "positive/negative area" so unions and differences stack under nonzero fill */
export function orientPolygon(path: number[], positive: boolean): number[] {
  if (path.length < 6) return path;
  const area = signedArea(path);
  if (area === 0) return path;
  if (area > 0 === positive) return path;
  const reversed: number[] = [];
  for (let i = path.length - 2; i >= 0; i -= 2) reversed.push(path[i], path[i + 1]);
  return reversed;
}

/** Rect / oval → polygon vertices (one representation, for direction normalization and boolean ops) */
export function shapePolygon(selection: {
  kind: SelectionKind;
  x: number;
  y: number;
  width: number;
  height: number;
  path: number[];
}): number[] {
  if (selection.kind === 'lasso' && selection.path.length >= 6) return [...selection.path];
  if (selection.kind === 'ellipse') {
    const rx = Math.max(0, selection.width / 2);
    const ry = Math.max(0, selection.height / 2);
    const cx = selection.x + rx;
    const cy = selection.y + ry;
    const points: number[] = [];
    for (let i = 0; i < 48; i += 1) {
      const angle = (i / 48) * Math.PI * 2;
      points.push(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry);
    }
    return points;
  }
  const { x, y, width, height } = selection;
  return [x, y, x + width, y, x + width, y + height, x, y + height];
}

/**
 * All outlines of a selection (including union / difference semantics).
 * The main outline is always a union; `hole` and `parts` entries with `add: false` are differences.
 */
export function selectionContours(selection: Selection): SelectionPart[] {
  const contours: SelectionPart[] = [{ path: shapePolygon(selection), add: true }];
  if (selection.hole && selection.hole.length >= 6) {
    contours.push({ path: [...selection.hole], add: false });
  }
  for (const part of selection.parts ?? []) {
    if (part.path.length >= 6) contours.push({ path: [...part.path], add: part.add });
  }
  return contours;
}

/** Selection bounds (bounding box of the union of all outlines) */
export function selectionBounds(selection: Selection): Rect {
  const contours = selectionContours(selection);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const contour of contours) {
    const bounds = polygonBounds(contour.path);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Write the selection into the current path: rect / oval / lasso / boolean results all become polygon subpaths,
 * with directions normalized by union (forward) / difference (reverse); callers must use the `nonzero` rule
 * (`ctx.fill('nonzero')` / `ctx.clip('nonzero')`).
 */
export function traceSelection(ctx: CanvasRenderingContext2D, selection: Selection): void {
  ctx.beginPath();
  for (const contour of selectionContours(selection)) {
    const path = orientPolygon(contour.path, contour.add);
    if (path.length < 6) continue;
    ctx.moveTo(path[0], path[1]);
    for (let i = 2; i < path.length; i += 2) ctx.lineTo(path[i], path[i + 1]);
    ctx.closePath();
  }
}

/** Selection → equivalent polygon points (for invert and other cases that join paths) */
export function selectionPolygon(selection: Selection): number[] {
  return shapePolygon(selection);
}

/**
 * Invert: the canvas frame becomes the union, and every original outline follows with its add/subtract flag flipped.
 * Verified under nonzero fill: the interior winds to 0 (unselected) and the area outside the original is 1 (selected).
 */
export function invertSelection(
  selection: Selection,
  canvas: { width: number; height: number },
): Selection {
  const contours = selectionContours(selection);
  return {
    kind: 'lasso',
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
    path: [0, 0, canvas.width, 0, canvas.width, canvas.height, 0, canvas.height],
    parts: contours.map((contour) => ({ path: contour.path, add: !contour.add })),
    feather: selection.feather,
  };
}

/** The whole canvas as a rectangular selection */
export function fullSelection(canvas: { width: number; height: number }): Selection {
  return {
    kind: 'rect',
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
    path: [],
    feather: 0,
  };
}

/**
 * Whether a selection contains a point: by nonzero winding number (union +1, difference -1, positive = inside).
 * It matches what `traceSelection` fills exactly, so brush clipping, fill and hit testing never contradict each other.
 */
export function pointInSelection(selection: Selection, px: number, py: number): boolean {
  let winding = 0;
  for (const contour of selectionContours(selection)) {
    if (pointInPolygon(contour.path, px, py)) winding += contour.add ? 1 : -1;
  }
  return winding !== 0;
}

export function pointInPolygon(path: number[], px: number, py: number): boolean {
  if (path.length < 6) return false;
  let inside = false;
  for (let i = 0, j = path.length - 2; i < path.length; j = i, i += 2) {
    const xi = path[i];
    const yi = path[i + 1];
    const xj = path[j];
    const yj = path[j + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Lasso vertices → bounding box */
export function polygonBounds(path: number[]): Rect {
  if (path.length < 2) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < path.length; i += 2) {
    minX = Math.min(minX, path[i]);
    maxX = Math.max(maxX, path[i]);
    minY = Math.min(minY, path[i + 1]);
    maxY = Math.max(maxY, path[i + 1]);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Thin out lasso vertices by step, so a long stroke doesn't produce tens of thousands of points */
export function simplifyPath(path: number[], minDistance = 3): number[] {
  if (path.length < 4) return path;
  const out: number[] = [path[0], path[1]];
  for (let i = 2; i < path.length; i += 2) {
    const x = path[i];
    const y = path[i + 1];
    const lastX = out[out.length - 2];
    const lastY = out[out.length - 1];
    if (Math.hypot(x - lastX, y - lastY) >= minDistance) out.push(x, y);
  }
  return out;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const value = hex.trim().replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

export function mixHex(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampUnit(alpha)})`;
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|\n\r\t]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  return cleaned.length > 0 ? cleaned : 'photo';
}

export function buildExportFilename(title: string, ext: string): string {
  return `${sanitizeFilename(title)}.${ext}`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

/* ------------------------------ File validation ------------------------------ */

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];
const SVG_EXTENSIONS = ['.svg'];

/**
 * Image file type detection.
 *
 * SVG is a class of its own: it is **not** a bitmap and must be rasterized on import (`render/svg.ts`),
 * so callers must distinguish "decode directly" from "read the size, then render at a multiple".
 */
export function resolveImageKind(filename: string): 'image' | 'svg' | 'unsupported' {
  const lower = filename.trim().toLowerCase();
  if (SVG_EXTENSIONS.some((ext) => lower.endsWith(ext))) return 'svg';
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext)) ? 'image' : 'unsupported';
}

export function checkImageFile(file: { name: string; size: number }): ToolResult<void> {
  if (resolveImageKind(file.name) === 'unsupported') return { ok: false, error: 'NOT_IMAGE' };
  if (file.size === 0) return { ok: false, error: 'EMPTY' };
  // SVG is text, so size is unrelated to pixel count, but still guard against huge files (editors treat them as bombs)
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: 'TOO_LARGE',
      params: { max: Math.round(MAX_IMAGE_BYTES / 1024 / 1024) },
    };
  }
  return { ok: true, value: undefined };
}

/**
 * PSD import validation.
 *
 * It shares the size-limit check with images, but the cap is looser (PSD holds many layers and is often far
 * larger); the real format check is the parse result from `psd/reader.ts` (bad files return INVALID_PSD).
 */
export function checkPsdFile(file: { name: string; size: number }): ToolResult<void> {
  if (!/\.psd$/i.test(file.name.trim())) return { ok: false, error: 'NOT_PSD' };
  if (file.size === 0) return { ok: false, error: 'EMPTY' };
  if (file.size > MAX_PSD_BYTES) {
    return {
      ok: false,
      error: 'TOO_LARGE',
      params: { max: Math.round(MAX_PSD_BYTES / 1024 / 1024) },
    };
  }
  return { ok: true, value: undefined };
}

export function checkProjectFile(file: { name: string; size: number }): ToolResult<void> {
  const lower = file.name.trim().toLowerCase();
  if (!lower.endsWith('.json') && !lower.endsWith('.photo.json')) {
    return { ok: false, error: 'NOT_PROJECT' };
  }
  if (file.size === 0) return { ok: false, error: 'EMPTY' };
  if (file.size > MAX_PROJECT_BYTES) {
    return {
      ok: false,
      error: 'TOO_LARGE',
      params: { max: Math.round(MAX_PROJECT_BYTES / 1024 / 1024) },
    };
  }
  return { ok: true, value: undefined };
}

/**
 * Project file version: imports reject future formats with it, and older versions are normalized by `model/migrate.ts`.
 * v2 → v3: filters went from `FilterId[]` to spec + parameters (`FilterSpec[]`), and adjustments gained
 * optional levels / curves / color balance / B&W / threshold / gradient map / desaturate parameters.
 * Old files still load (`normalizeFilters` accepts string arrays), but new files should not open in old builds.
 */
export const PROJECT_VERSION = 3;

/* ------------------------------------------------------------------ *
 * Layer stack: flat array + parentId → compositing instruction sequence
 * ------------------------------------------------------------------ */

export type StackStep =
  | { kind: 'group-begin'; layer: GroupLayer }
  | { kind: 'group-end'; layer: GroupLayer }
  | { kind: 'layer'; layer: Layer };

/**
 * Expand `doc.layers` (flat, tail = topmost) into an ordered list of compositing instructions.
 *
 * Convention: a group's children follow the group and point back to it via `parentId`, so indexing by
 * `parentId` and recursing is enough. A `parentId` that is missing / not a group degrades to the top level
 * (so old projects or odd migrations don't lose layers).
 */
export function flattenStack(doc: PhotoDoc): StackStep[] {
  const knownIds = new Set(doc.layers.map((layer) => layer.id));
  const childrenOf = new Map<string, Layer[]>();
  const roots: Layer[] = [];

  for (const layer of doc.layers) {
    const parentId = layer.parentId ?? null;
    if (parentId && knownIds.has(parentId)) {
      const list = childrenOf.get(parentId);
      if (list) list.push(layer);
      else childrenOf.set(parentId, [layer]);
    } else {
      roots.push(layer);
    }
  }

  const steps: StackStep[] = [];
  const walk = (list: Layer[]) => {
    for (const layer of list) {
      if (layer.kind === 'group') {
        steps.push({ kind: 'group-begin', layer });
        walk(childrenOf.get(layer.id) ?? []);
        steps.push({ kind: 'group-end', layer });
      } else {
        steps.push({ kind: 'layer', layer });
      }
    }
  };
  walk(roots);
  return steps;
}

/** Subtree ids (itself + all descendants), in `doc.layers` order */
export function subtreeIdsOf(doc: PhotoDoc, id: string): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const layer of doc.layers) {
    const parentId = layer.parentId ?? null;
    if (!parentId) continue;
    const list = childrenOf.get(parentId);
    if (list) list.push(layer.id);
    else childrenOf.set(parentId, [layer.id]);
  }
  const out: string[] = [];
  const walk = (current: string) => {
    out.push(current);
    for (const child of childrenOf.get(current) ?? []) walk(child);
  };
  walk(id);
  return out;
}

/** Direct children of a group (in layer-stack order) */
export function childrenOfLayer(doc: PhotoDoc, id: string): Layer[] {
  return doc.layers.filter((layer) => (layer.parentId ?? null) === id);
}

/**
 * Move a layer (with its subtree) under a target parent and return the new layer array.
 *
 * Pure: the input array is not mutated. Placement rules —
 * - target parent null → move to the top level (end of the array);
 * - target is a group → right after that group's subtree (i.e. the topmost child);
 * - target is one of its own descendants → refuse (would create a cycle) and return the input unchanged.
 */
export function moveSubtree(layers: Layer[], id: string, targetParentId: string | null): Layer[] {
  const byId = new Map(layers.map((layer) => [layer.id, layer] as const));
  const moving = layers.find((layer) => layer.id === id);
  if (!moving) return layers;

  // Cycle check: the target parent must not be a descendant of itself
  if (targetParentId) {
    const descendants = new Set<string>();
    const walk = (current: string) => {
      for (const child of layers.filter((layer) => (layer.parentId ?? null) === current)) {
        descendants.add(child.id);
        walk(child.id);
      }
    };
    walk(id);
    if (targetParentId === id || descendants.has(targetParentId)) return layers;
    if (!byId.has(targetParentId)) return layers;
  }

  const movingIds = new Set<string>();
  {
    const walk = (current: string) => {
      movingIds.add(current);
      for (const child of layers.filter((layer) => (layer.parentId ?? null) === current)) {
        walk(child.id);
      }
    };
    walk(id);
  }

  const rest = layers.filter((layer) => !movingIds.has(layer.id));
  const moved = layers
    .filter((layer) => movingIds.has(layer.id))
    .map((layer) => (layer.id === id ? { ...layer, parentId: targetParentId } : layer));

  if (!targetParentId) return [...rest, ...moved];

  // Insert point: after the target group's subtree
  const targetIds = new Set<string>();
  {
    const walk = (current: string) => {
      targetIds.add(current);
      for (const child of layers.filter((layer) => (layer.parentId ?? null) === current)) {
        walk(child.id);
      }
    };
    walk(targetParentId);
  }
  const at = rest.findIndex((layer) => targetIds.has(layer.id));
  let insertAt = rest.length;
  if (at >= 0) {
    insertAt = at + 1;
    while (insertAt < rest.length && targetIds.has(rest[insertAt].id)) insertAt += 1;
  }
  return [...rest.slice(0, insertAt), ...moved, ...rest.slice(insertAt)];
}

/** Ancestor chain (outermost first) */
export function ancestorChainOf(doc: PhotoDoc, layer: Layer): Layer[] {
  const byId = new Map(doc.layers.map((item) => [item.id, item] as const));
  const chain: Layer[] = [];
  let cursor = layer.parentId ?? null;
  const guard = new Set<string>();
  while (cursor && !guard.has(cursor)) {
    guard.add(cursor);
    const parent = byId.get(cursor);
    if (!parent) break;
    chain.unshift(parent);
    cursor = parent.parentId ?? null;
  }
  return chain;
}

/** Groups pass visibility down: any hidden ancestor makes the child hidden */
export function effectiveVisible(doc: PhotoDoc, layer: Layer): boolean {
  if (!layer.visible) return false;
  return ancestorChainOf(doc, layer).every((parent) => parent.visible);
}

/** Locking inherits too (Photoshop behavior: children of a locked group cannot be edited either) */
export function effectiveLocked(doc: PhotoDoc, layer: Layer): boolean {
  if (layer.locked) return true;
  return ancestorChainOf(doc, layer).some((parent) => parent.locked);
}

/** Mask bake cache key: changes when mask pixels or parameters change; null when there is no mask */
export function maskSignature(layer: Layer): string | null {
  const mask = layer.mask;
  if (!mask || !mask.assetId || !mask.enabled) return null;
  return `${mask.assetId}:${mask.rev}:${mask.inverted ? 1 : 0}:${mask.density.toFixed(3)}:${mask.feather}`;
}

/** One row in the history panel (display only: label key + time + whether it is the current state) */
export interface HistoryRow {
  label: HistoryLabel;
  at: number;
  current: boolean;
}

/**
 * Derive the panel's row list from past / future.
 * The row list is the timeline: 0 = initial state, past.length = current, the end = furthest redoable state.
 * Clicking row i calls `jumpTo(i)`.
 */
export function historyTimeline(past: HistoryEntry[], future: HistoryEntry[]): HistoryRow[] {
  const rows: HistoryRow[] = past.map((entry, index) => ({
    label: index === 0 ? 'histOpen' : past[index - 1].label,
    at: index === 0 ? entry.at : past[index - 1].at,
    current: false,
  }));
  rows.push({
    label: past.length > 0 ? past[past.length - 1].label : 'histOpen',
    at: past.length > 0 ? past[past.length - 1].at : 0,
    current: true,
  });
  for (const entry of future) rows.push({ label: entry.label, at: entry.at, current: false });
  return rows;
}

/** Every asset id a layer references (bitmap / smart object source / mask), for asset GC and serialization */
export function layerAssetIds(layer: Layer): string[] {
  const ids: string[] = [];
  if (layer.kind === 'raster' && layer.assetId) ids.push(layer.assetId);
  if (layer.kind === 'smart' && layer.sourceAssetId) ids.push(layer.sourceAssetId);
  if (layer.mask?.assetId) ids.push(layer.mask.assetId);
  return ids;
}
