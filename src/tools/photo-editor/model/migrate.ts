import {
  BLEND_MODES,
  FILTERS,
  FILTER_PARAMS,
  MAX_CANVAS_SIZE,
  MAX_EFFECT_DISTANCE,
  MAX_EFFECT_SIZE,
  MAX_EFFECT_SPREAD,
  MAX_VECTOR_CONTOURS,
  MAX_VECTOR_FEATHER,
  MIN_CANVAS_SIZE,
  normalizeMesh,
  TEXT_WARP_KINDS,
  clampWarpAmount,
  SELECTIVE_RANGES,
  defaultFilterParams,
} from '../core';
import { createAdjustments, createId } from './factory';
import type {
  Adjustments,
  BlackWhiteParams,
  BlendMode,
  ChannelMixerParams,
  PhotoFilterParams,
  ReplaceColorParams,
  SelectiveColorParams,
  ShadowsHighlightsParams,
  TextWarp,
  TextWarpKind,
  ColorBalanceParams,
  CurvePoint,
  CurvesParams,
  FilterId,
  FilterSpec,
  GradientMapParams,
  Layer,
  LayerKind,
  LayerStyle,
  LevelsParams,
  MaskRef,
  PhotoDoc,
  SelectionPart,
  VectorMaskRef,
} from './types';

/**
 * Document normalization / migration: turn raw objects from projects, drafts or old versions into `PhotoDoc`.
 *
 * Design notes:
 * - **fill in, never guess**: missing fields get type defaults; a wrong type drops that layer (no throw), so
 *   one corrupt layer can't make the whole document unopenable;
 * - **referential integrity**: a `parentId` pointing at a missing / non-group layer degrades to top level;
 * - v1 (no groups / masks / adjustment layers) migrates straight to v2: new fields default, behavior unchanged.
 */

const KINDS: LayerKind[] = ['raster', 'text', 'shape', 'group', 'adjustment', 'smart'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function clampSize(value: number): number {
  return Math.min(MAX_CANVAS_SIZE, Math.max(MIN_CANVAS_SIZE, Math.round(value)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeBlend(value: unknown): BlendMode {
  return BLEND_MODES.includes(value as BlendMode) ? (value as BlendMode) : 'normal';
}

function normalizePoints(value: unknown): CurvePoint[] {
  if (!Array.isArray(value)) return [];
  const points: CurvePoint[] = [];
  for (const item of value) {
    if (!isObject(item)) continue;
    const x = num(item.x, NaN);
    const y = num(item.y, NaN);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push({ x: clamp(x, 0, 255), y: clamp(y, 0, 255) });
    }
  }
  return points;
}

function normalizeLevels(value: unknown): LevelsParams | null {
  if (!isObject(value)) return null;
  return {
    inBlack: clamp(num(value.inBlack, 0), 0, 255),
    inWhite: clamp(num(value.inWhite, 255), 0, 255),
    gamma: clamp(num(value.gamma, 1), 0.05, 10),
    outBlack: clamp(num(value.outBlack, 0), 0, 255),
    outWhite: clamp(num(value.outWhite, 255), 0, 255),
  };
}

function normalizeCurves(value: unknown): CurvesParams | null {
  if (!isObject(value)) return null;
  const rgb = normalizePoints(value.rgb);
  const red = normalizePoints(value.red);
  const green = normalizePoints(value.green);
  const blue = normalizePoints(value.blue);
  if (rgb.length < 2 && !red.length && !green.length && !blue.length) return null;
  return {
    rgb: rgb.length >= 2 ? rgb : [],
    red: red.length >= 2 ? red : null,
    green: green.length >= 2 ? green : null,
    blue: blue.length >= 2 ? blue : null,
  };
}

function normalizeTriple(value: unknown): number[] {
  if (!Array.isArray(value)) return [0, 0, 0];
  return [0, 1, 2].map((index) => clamp(num(value[index], 0), -100, 100));
}

function normalizeColorBalance(value: unknown): ColorBalanceParams | null {
  if (!isObject(value)) return null;
  const params: ColorBalanceParams = {
    shadows: normalizeTriple(value.shadows),
    midtones: normalizeTriple(value.midtones),
    highlights: normalizeTriple(value.highlights),
  };
  if ([...params.shadows, ...params.midtones, ...params.highlights].every((v) => v === 0)) {
    return null;
  }
  return params;
}

function normalizeBlackWhite(value: unknown): BlackWhiteParams | null {
  if (!isObject(value)) return null;
  return {
    red: clamp(num(value.red, 40), -100, 300),
    yellow: clamp(num(value.yellow, 60), -100, 300),
    green: clamp(num(value.green, 40), -100, 300),
    cyan: clamp(num(value.cyan, 60), -100, 300),
    blue: clamp(num(value.blue, 20), -100, 300),
    magenta: clamp(num(value.magenta, 80), -100, 300),
  };
}

function normalizeGradientMap(value: unknown): GradientMapParams | null {
  if (!isObject(value) || !Array.isArray(value.stops)) return null;
  const stops: { pos: number; color: string }[] = [];
  for (const item of value.stops) {
    if (!isObject(item)) continue;
    const color = str(item.color);
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) continue;
    stops.push({ pos: clamp(num(item.pos, 0), 0, 1), color: color.toUpperCase() });
  }
  if (stops.length < 2) return null;
  return { stops: stops.sort((a, b) => a.pos - b.pos) };
}

function normalizeAdjustments(value: unknown): Adjustments {
  const base = createAdjustments();
  if (!isObject(value)) return base;
  base.brightness = num(value.brightness, 0);
  base.contrast = num(value.contrast, 0);
  base.saturation = num(value.saturation, 0);
  base.hue = num(value.hue, 0);
  base.temperature = num(value.temperature, 0);
  base.exposure = num(value.exposure, 0);
  base.sharpen = num(value.sharpen, 0);
  base.levels = normalizeLevels(value.levels);
  base.curves = normalizeCurves(value.curves);
  base.colorBalance = normalizeColorBalance(value.colorBalance);
  base.blackWhite = normalizeBlackWhite(value.blackWhite);
  base.threshold =
    typeof value.threshold === 'number' && Number.isFinite(value.threshold)
      ? clamp(value.threshold, 0, 255)
      : null;
  base.gradientMap = normalizeGradientMap(value.gradientMap);
  base.desaturate = bool(value.desaturate, false) ? true : undefined;
  base.photoFilter = normalizePhotoFilter(value.photoFilter);
  base.channelMixer = normalizeChannelMixer(value.channelMixer);
  base.shadowsHighlights = normalizeShadowsHighlights(value.shadowsHighlights);
  base.selectiveColor = normalizeSelectiveColor(value.selectiveColor);
  base.replaceColor = normalizeReplaceColor(value.replaceColor);
  return base;
}

/* --------------------------- More adjustments (P1-C2) --------------------------- */

function normalizeRow(value: unknown, size: number, min: number, max: number): number[] {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: size }, (_, index) => clamp(num(source[index], 0), min, max));
}

function normalizePhotoFilter(value: unknown): PhotoFilterParams | null {
  if (!isObject(value)) return null;
  return {
    color: color(value.color, '#EC8A00'),
    density: clamp(num(value.density, 25), 0, 100),
    preserveLuminosity: bool(value.preserveLuminosity, true),
  };
}

function normalizeChannelMixer(value: unknown): ChannelMixerParams | null {
  if (!isObject(value)) return null;
  return {
    red: normalizeRow(value.red, 4, -200, 200),
    green: normalizeRow(value.green, 4, -200, 200),
    blue: normalizeRow(value.blue, 4, -200, 200),
  };
}

function normalizeShadowsHighlights(value: unknown): ShadowsHighlightsParams | null {
  if (!isObject(value)) return null;
  return {
    shadows: clamp(num(value.shadows, 0), 0, 100),
    highlights: clamp(num(value.highlights, 0), 0, 100),
  };
}

/** Selective color: 9 ranges × 4 values in -100~100; all-zero is kept (users may add it first, tune later) */
function normalizeSelectiveColor(value: unknown): SelectiveColorParams | null {
  if (!isObject(value)) return null;
  const source = isObject(value.ranges) ? value.ranges : {};
  const ranges = {} as SelectiveColorParams['ranges'];
  for (const range of SELECTIVE_RANGES) {
    ranges[range] = normalizeRow(source[range], 4, -100, 100);
  }
  return { ranges };
}

function normalizeReplaceColor(value: unknown): ReplaceColorParams | null {
  if (!isObject(value)) return null;
  if (!HEX_COLOR.test(str(value.color))) return null;
  return {
    color: color(value.color, '#FF0000'),
    hue: clamp(num(value.hue, 0), -180, 180),
    saturation: clamp(num(value.saturation, 0), -100, 100),
    lightness: clamp(num(value.lightness, 0), -100, 100),
    fuzziness: clamp(num(value.fuzziness, 60), 1, 200),
  };
}

/**
 * Filter normalization: accepts the old `FilterId[]` (upgraded to specs with defaults) and `FilterSpec[]`.
 * Unknown ids are dropped and missing parameters default from `FILTER_PARAMS`.
 */
function normalizeFilters(value: unknown): FilterSpec[] {
  if (!Array.isArray(value)) return [];
  const out: FilterSpec[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      if (FILTERS.includes(item as FilterId)) {
        const id = item as FilterId;
        out.push({ id, params: defaultFilterParams(id) });
      }
      continue;
    }
    if (!isObject(item) || !FILTERS.includes(item.id as FilterId)) continue;
    const id = item.id as FilterId;
    const rawParams = isObject(item.params) ? item.params : {};
    const params: Record<string, number> = {};
    for (const param of FILTER_PARAMS[id]) {
      params[param.key] = clamp(num(rawParams[param.key], param.default), param.min, param.max);
    }
    // Only write enabled when explicitly disabled, keeping project files compact (absent = enabled)
    out.push({ id, params, ...(item.enabled === false ? { enabled: false } : {}) });
  }
  return out;
}

function normalizeMask(value: unknown): MaskRef | null {
  if (!isObject(value)) return null;
  const assetId = str(value.assetId);
  if (!assetId) return null;
  return {
    assetId,
    rev: Math.max(1, Math.round(num(value.rev, 1))),
    enabled: bool(value.enabled, true),
    inverted: bool(value.inverted, false),
    density: Math.min(1, Math.max(0, num(value.density, 1))),
    feather: Math.max(0, num(value.feather, 0)),
  };
}

/**
 * Vector mask normalization: an outline must be an even count of finite numbers; under 3 points is dropped.
 * If every outline is invalid the whole mask becomes null, avoiding a switch that never does anything.
 */
function normalizeVectorMask(value: unknown): VectorMaskRef | null {
  if (!isObject(value)) return null;
  if (!Array.isArray(value.contours)) return null;
  const contours: SelectionPart[] = [];
  for (const item of value.contours) {
    if (!isObject(item) || !Array.isArray(item.path)) continue;
    const path: number[] = [];
    for (const point of item.path) {
      if (typeof point === 'number' && Number.isFinite(point)) path.push(point);
    }
    if (path.length % 2 !== 0) path.pop();
    if (path.length < 6) continue;
    contours.push({ path, add: bool(item.add, true) });
    if (contours.length >= MAX_VECTOR_CONTOURS) break;
  }
  if (contours.length === 0) return null;
  return {
    enabled: bool(value.enabled, true),
    inverted: bool(value.inverted, false),
    contours,
    feather: clamp(num(value.feather, 0), 0, MAX_VECTOR_FEATHER),
  };
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Text warp normalization: invalid kinds fall back to none, strengths clamp to -100~100 */
function normalizeTextWarp(value: unknown): TextWarp {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<TextWarp>;
  const kind = TEXT_WARP_KINDS.includes(raw.kind as never) ? (raw.kind as TextWarpKind) : 'none';
  return {
    kind,
    bend: clampWarpAmount(num(raw.bend, 0)),
    horizontal: clampWarpAmount(num(raw.horizontal, 0)),
  };
}

/** Palette normalization: keep valid `#RRGGBB`, de-duplicate, cap length (lightweight extras, dropped silently) */
function normalizeSwatches(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const hex = color(item, '');
    if (!hex || out.includes(hex)) continue;
    out.push(hex);
    if (out.length >= 32) break;
  }
  return out;
}

function color(value: unknown, fallback: string): string {
  const raw = str(value);
  return HEX_COLOR.test(raw) ? raw.toUpperCase() : fallback;
}

/**
 * Layer style normalization: validate each effect's type and range.
 * Unknown effects are dropped (no guessing); the style object survives if any effect does, else null.
 */
export function normalizeLayerStyle(value: unknown): LayerStyle | null {
  if (!isObject(value)) return null;
  const style: LayerStyle = {};

  const shadow = value.dropShadow;
  if (isObject(shadow)) {
    style.dropShadow = {
      enabled: bool(shadow.enabled, false),
      color: color(shadow.color, '#000000'),
      opacity: clamp(num(shadow.opacity, 0.6), 0, 1),
      angle: num(shadow.angle, 135),
      distance: clamp(num(shadow.distance, 6), 0, MAX_EFFECT_DISTANCE),
      spread: clamp(num(shadow.spread, 0), 0, MAX_EFFECT_SPREAD),
      size: clamp(num(shadow.size, 8), 0, MAX_EFFECT_SIZE),
    };
  }

  const inner = value.innerShadow;
  if (isObject(inner)) {
    style.innerShadow = {
      enabled: bool(inner.enabled, false),
      color: color(inner.color, '#000000'),
      opacity: clamp(num(inner.opacity, 0.5), 0, 1),
      angle: num(inner.angle, 135),
      distance: clamp(num(inner.distance, 4), 0, MAX_EFFECT_DISTANCE),
      size: clamp(num(inner.size, 6), 0, MAX_EFFECT_SIZE),
    };
  }

  const glow = value.outerGlow;
  if (isObject(glow)) {
    style.outerGlow = {
      enabled: bool(glow.enabled, false),
      color: color(glow.color, '#FACC15'),
      opacity: clamp(num(glow.opacity, 0.75), 0, 1),
      size: clamp(num(glow.size, 12), 0, MAX_EFFECT_SIZE),
    };
  }

  const stroke = value.stroke;
  if (isObject(stroke)) {
    style.stroke = {
      enabled: bool(stroke.enabled, false),
      color: color(stroke.color, '#FFFFFF'),
      opacity: clamp(num(stroke.opacity, 1), 0, 1),
      size: clamp(num(stroke.size, 3), 0, MAX_EFFECT_SIZE),
      position:
        stroke.position === 'inside' || stroke.position === 'center' ? stroke.position : 'outside',
    };
  }

  const overlay = value.colorOverlay;
  if (isObject(overlay)) {
    style.colorOverlay = {
      enabled: bool(overlay.enabled, false),
      color: color(overlay.color, '#2563EB'),
      opacity: clamp(num(overlay.opacity, 0.65), 0, 1),
    };
  }

  return Object.keys(style).length > 0 ? style : null;
}

function normalizeLayer(raw: unknown): Layer | null {
  if (!isObject(raw)) return null;
  const kind = raw.kind as LayerKind;
  if (!KINDS.includes(kind)) return null;

  const base = {
    id: str(raw.id) || createId(kind),
    name: str(raw.name),
    visible: bool(raw.visible, true),
    locked: bool(raw.locked, false),
    lockPosition: bool(raw.lockPosition, false),
    lockAlpha: bool(raw.lockAlpha, false),
    opacity: Math.min(1, Math.max(0, num(raw.opacity, 1))),
    blend: normalizeBlend(raw.blend),
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    width: Math.max(1, num(raw.width, 1)),
    height: Math.max(1, num(raw.height, 1)),
    rotation: num(raw.rotation, 0),
    flipX: bool(raw.flipX, false),
    flipY: bool(raw.flipY, false),
    parentId: typeof raw.parentId === 'string' && raw.parentId ? raw.parentId : null,
    expanded: bool(raw.expanded, true),
    mask: normalizeMask(raw.mask),
    vectorMask: normalizeVectorMask(raw.vectorMask),
    clipped: bool(raw.clipped, false),
    style: normalizeLayerStyle(raw.style),
    mesh: normalizeMesh(raw.mesh),
  };

  switch (kind) {
    case 'raster':
      return {
        ...base,
        kind,
        assetId: str(raw.assetId),
        rev: Math.max(1, Math.round(num(raw.rev, 1))),
        adjustments: normalizeAdjustments(raw.adjustments),
        filters: normalizeFilters(raw.filters),
      };
    case 'smart':
      return {
        ...base,
        kind,
        sourceAssetId: str(raw.sourceAssetId),
        sourceWidth: Math.max(1, Math.round(num(raw.sourceWidth, 1))),
        sourceHeight: Math.max(1, Math.round(num(raw.sourceHeight, 1))),
        // Smart objects also carry the non-destructive set; old projects lack it → empty stack, no adjustments
        adjustments: normalizeAdjustments(raw.adjustments),
        filters: normalizeFilters(raw.filters),
      };
    case 'adjustment':
      return {
        ...base,
        kind,
        adjustments: normalizeAdjustments(raw.adjustments),
        filters: normalizeFilters(raw.filters),
      };
    case 'group':
      return { ...base, kind, passThrough: bool(raw.passThrough, true) };
    case 'text':
      return {
        ...base,
        kind,
        text: str(raw.text),
        fontSize: Math.max(1, num(raw.fontSize, 24)),
        fontFamily: str(raw.fontFamily, 'PingFang SC'),
        fill: str(raw.fill, '#111827'),
        bold: bool(raw.bold, false),
        italic: bool(raw.italic, false),
        underline: bool(raw.underline, false),
        align: (['left', 'center', 'right'] as const).includes(raw.align as never)
          ? (raw.align as 'left' | 'center' | 'right')
          : 'left',
        lineHeight: Math.max(1, num(raw.lineHeight, 1.4)),
        letterSpacing: num(raw.letterSpacing, 0),
        paragraphSpacing: Math.max(0, num(raw.paragraphSpacing, 0)),
        warp: normalizeTextWarp(raw.warp),
      };
    default:
      return {
        ...base,
        kind: 'shape',
        shape: (['rect', 'roundRect', 'ellipse', 'line', 'arrow', 'star'] as const).includes(
          raw.shape as never,
        )
          ? (raw.shape as 'rect' | 'roundRect' | 'ellipse' | 'line' | 'arrow' | 'star')
          : 'rect',
        fill: str(raw.fill, '#2563EB'),
        stroke: str(raw.stroke, '#1D4ED8'),
        strokeWidth: Math.max(0, num(raw.strokeWidth, 0)),
        cornerRadius: Math.max(0, num(raw.cornerRadius, 12)),
      };
  }
}

/**
 * Normalize (including v1 → v2): null means the structure is unusable (callers treat it as an empty document).
 *
 * Referential integrity comes last: parse every layer first, then clear parentIds that point nowhere
 * or at non-groups, and break cycles (a self-referencing parent chain would loop forever).
 */
export function migrateDoc(raw: unknown): PhotoDoc | null {
  if (!isObject(raw)) return null;
  if (!Array.isArray(raw.layers)) return null;
  if (typeof raw.width !== 'number' || typeof raw.height !== 'number') return null;

  const layers: Layer[] = [];
  for (const item of raw.layers) {
    const layer = normalizeLayer(item);
    if (layer) layers.push(layer);
  }

  const groupIds = new Set(
    layers.filter((layer) => layer.kind === 'group').map((layer) => layer.id),
  );
  for (const layer of layers) {
    if (!layer.parentId) continue;
    // Parent missing, not a group, or pointing at itself → degrade to the top level
    if (!groupIds.has(layer.parentId) || layer.parentId === layer.id) layer.parentId = null;
  }
  // Break cycles: if a group's ancestor chain loops back to itself, degrade it to the top level
  const byId = new Map(layers.map((layer) => [layer.id, layer] as const));
  for (const layer of layers) {
    const seen = new Set<string>([layer.id]);
    let cursor = layer.parentId;
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      cursor = byId.get(cursor)?.parentId ?? null;
    }
    if (cursor) layer.parentId = null;
  }

  const activeLayerId = str(raw.activeLayerId);
  return {
    id: str(raw.id) || createId('doc'),
    name: str(raw.name),
    width: clampSize(raw.width),
    height: clampSize(raw.height),
    background: (['transparent', 'white', 'black'] as const).includes(raw.background as never)
      ? (raw.background as PhotoDoc['background'])
      : 'white',
    layers,
    activeLayerId:
      activeLayerId && layers.some((layer) => layer.id === activeLayerId) ? activeLayerId : null,
    swatches: normalizeSwatches(raw.swatches),
  };
}
