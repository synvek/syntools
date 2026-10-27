/**
 * Core mechanism for shape "adjustable parameters" (draw.io-style adjustment vertices).
 *
 * Single source of truth: each parameter is declared once (shape-specific ones in `ShapeDef.adjust`,
 * generic ones derived from `draw` / `decor`, such as corner radius, fold, shear, compartment height…),
 * and the renderer, canvas handles, property panel and draw.io import/export all share the same declarations and resolver,
 * so 20+ parameters do not each reimplement their own interaction and mapping logic.
 *
 * Convention: `w` / `h` are the node's pixel size; every function guards against bad sizes (never produces NaN).
 */

import { type FlowNodeStyle, SWIMLANE_HEADER_HEIGHT, SWIMLANE_HEADER_WIDTH } from '../types';
import type { ShapeDef } from './index';

/** Parameter reader: key → value (already clamped to min/max); reusable by the renderer */
export type ParamGetter = (key: string) => number;

/** Point in the node's local coordinate system */
export interface AdjustPoint {
  x: number;
  y: number;
}

/** mxGraph (draw.io) two-way mapping: write / read an adjustable parameter to and from tokens such as `size` */
export interface AdjustMx {
  /** mxGraph token name, e.g. 'size' | 'arcSize' */
  key: string;
  /** Value → token value string */
  to: (value: number, w: number, h: number) => string;
  /** Token value → value; returns null when parsing fails (the token is then kept verbatim in mxStyle) */
  from: (raw: string, w: number, h: number) => number | null;
}

/** Declarative metadata for a single adjustable parameter; shared by all four consumers */
export interface ShapeAdjustDef {
  key: string;
  /** i18n suffix: `tools.flowchart.shapeParam.*` */
  labelKey: string;
  unit: 'px' | 'ratio';
  default: (w: number, h: number) => number;
  min: (w: number, h: number) => number;
  max: (w: number, h: number) => number;
  /** Value → handle position in node-local coordinates */
  anchor: (w: number, h: number, value: number) => AdjustPoint;
  /** Pointer position in local coordinates → new value */
  project: (x: number, y: number, w: number, h: number) => number;
  mx?: AdjustMx;
}

/* ------------------------------ mx mapping helpers ------------------------------ */

/** Absolute pixel parameter → `size=<px>`; on import a value ≤1 is treated as a draw.io ratio (× the reference size) */
export function pxMx(ref: (w: number, h: number) => number): AdjustMx {
  return {
    key: 'size',
    to: (v) => String(Math.round(v)),
    from: (raw, w, h) => {
      const n = Number(raw);
      if (!Number.isFinite(n)) return null;
      return n <= 1 ? n * ref(w, h) : n;
    },
  };
}

/** Ratio parameter → `size=<ratio>` (draw.io ratio semantics) */
export function ratioMx(): AdjustMx {
  return {
    key: 'size',
    to: (v) => String(Math.round(v * 1000) / 1000),
    from: (raw) => {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    },
  };
}

/** Corner radius → `arcSize` (keeping the existing export convention: arcSize = cornerRadius / 2) */
function arcSizeMx(): AdjustMx {
  return {
    key: 'arcSize',
    to: (v) => String(Math.round((v / 2) * 100) / 100),
    from: (raw) => {
      const n = Number(raw);
      return Number.isFinite(n) ? n * 2 : null;
    },
  };
}

/* ------------------------------ Linear-axis factory ------------------------------ */

export interface LinearAdjustOptions {
  key: string;
  labelKey: string;
  unit?: 'px' | 'ratio';
  /** Drag axis */
  axis: 'x' | 'y';
  /** Value = axis coordinate × scale(w,h) + bias(w,h); scale=1 / bias=0 by default */
  scale?: (w: number, h: number) => number;
  bias?: (w: number, h: number) => number;
  /** Coordinate of the handle on the other axis (may vary with the value) */
  cross: number | ((w: number, h: number, value: number) => number);
  default: (w: number, h: number) => number;
  min?: (w: number, h: number) => number;
  max: (w: number, h: number) => number;
  mx?: AdjustMx;
}

/** Adjustable parameter dragged along a single axis: handle position and pointer projection are inverse transforms */
export function axisAdjust(o: LinearAdjustOptions): ShapeAdjustDef {
  const scale = o.scale ?? (() => 1);
  const bias = o.bias ?? (() => 0);
  const min = o.min ?? (() => 0);
  const crossOf =
    typeof o.cross === 'function' ? o.cross : () => (typeof o.cross === 'number' ? o.cross : 0);
  return {
    key: o.key,
    labelKey: o.labelKey,
    unit: o.unit ?? 'px',
    default: o.default,
    min,
    max: o.max,
    project: (x, y, w, h) => (o.axis === 'x' ? x : y) * scale(w, h) + bias(w, h),
    anchor: (w, h, value) => {
      const coord = (value - bias(w, h)) / scale(w, h);
      return o.axis === 'x'
        ? { x: coord, y: crossOf(w, h, value) }
        : { x: crossOf(w, h, value), y: coord };
    },
    mx: o.mx,
  };
}

/** Fold at the top-right corner (note / card / artifact / data object): value = fold edge length in px */
export function foldAdjust(
  labelKey: string,
  dflt: (w: number, h: number) => number,
): ShapeAdjustDef {
  return axisAdjust({
    key: 'foldSize',
    labelKey,
    axis: 'x',
    scale: () => -1,
    bias: (w) => w,
    cross: (_w, _h, value) => value,
    default: dflt,
    max: (w, h) => Math.min(w, h) * 0.9,
    mx: pxMx((w, h) => Math.min(w, h)),
  });
}

/* ------------------------------ Derivation rules ------------------------------ */

/** Read-only cache: derived results for the same ShapeDef are reused, avoiding allocation on the render hot path */
const adjustCache = new WeakMap<ShapeDef, ShapeAdjustDef[]>();

/** Generic parameters derived from `draw` / `decor` (order is the panel order, placed before shape-specific items) */
function derivedAdjusts(def: ShapeDef): ShapeAdjustDef[] {
  const out: ShapeAdjustDef[] = [];
  switch (def.draw) {
    case 'rect':
      out.push(
        axisAdjust({
          key: 'cornerRadius',
          labelKey: 'cornerRadius',
          axis: 'x',
          cross: 0,
          default: () => 4,
          max: (w, h) => Math.min(w, h) / 2,
          mx: arcSizeMx(),
        }),
      );
      break;
    case 'roundRect':
      out.push(
        axisAdjust({
          key: 'cornerRadius',
          labelKey: 'cornerRadius',
          axis: 'x',
          cross: 0,
          default: () => 10,
          max: (w, h) => Math.min(w, h) / 2,
          mx: arcSizeMx(),
        }),
      );
      break;
    case 'note':
      out.push(foldAdjust('foldSize', (w) => Math.min(16, w * 0.13)));
      break;
    case 'card':
      out.push(foldAdjust('foldSize', (w, h) => Math.min(22, w * 0.22, h * 0.5)));
      break;
    case 'parallelogram':
    case 'invParallelogram':
      out.push(
        axisAdjust({
          key: 'skew',
          labelKey: 'skew',
          axis: 'x',
          cross: 0,
          default: (_w, h) => h * 0.25,
          max: (w) => w * 0.8,
          mx: pxMx((_w, h) => h),
        }),
      );
      break;
    case 'trapezoid':
    case 'invTrapezoid':
    case 'hexagon':
      out.push(
        axisAdjust({
          key: 'inset',
          labelKey: 'inset',
          axis: 'x',
          cross: 0,
          default: (w) => w * 0.16,
          max: (w) => w * 0.45,
          mx: pxMx((w) => w),
        }),
      );
      break;
    case 'cylinder':
      out.push(
        axisAdjust({
          key: 'capHeight',
          labelKey: 'capHeight',
          axis: 'y',
          cross: (w) => w / 2,
          default: (w, h) => Math.min(h * 0.16, w * 0.22),
          max: (w, h) => Math.min(h * 0.45, w * 0.5),
          mx: pxMx((_w, h) => h),
        }),
      );
      break;
    case 'document':
      out.push(
        axisAdjust({
          key: 'waveHeight',
          labelKey: 'waveHeight',
          axis: 'y',
          scale: () => -1,
          bias: (_w, h) => h,
          cross: (w) => w / 2,
          default: (_w, h) => Math.min(14, h * 0.2),
          max: (_w, h) => h * 0.5,
          mx: pxMx((_w, h) => h),
        }),
      );
      break;
    case 'chevron':
      out.push(
        axisAdjust({
          key: 'chevronDepth',
          labelKey: 'chevronDepth',
          axis: 'x',
          cross: (_w, h) => h / 2,
          default: (w) => w * 0.38,
          max: (w) => w * 0.8,
          mx: pxMx((w) => w),
        }),
      );
      break;
    case 'callout':
      out.push(
        axisAdjust({
          key: 'calloutTail',
          labelKey: 'calloutTail',
          axis: 'y',
          scale: () => -1,
          bias: (_w, h) => h,
          cross: (w) => w / 2,
          default: (_w, h) => h * 0.2,
          max: (_w, h) => h * 0.6,
          mx: pxMx((_w, h) => h),
        }),
      );
      break;
    case 'plus':
    case 'cross':
      out.push(
        axisAdjust({
          key: 'plusArm',
          labelKey: 'plusArm',
          unit: 'ratio',
          axis: 'x',
          scale: (w) => 1 / Math.max(1, w),
          cross: 0,
          default: () => 0.34,
          min: () => 0.05,
          max: () => 0.5,
          mx: ratioMx(),
        }),
      );
      break;
    case 'arrow':
      out.push(
        axisAdjust({
          key: 'arrowHead',
          labelKey: 'arrowHead',
          axis: 'x',
          scale: () => -1,
          bias: (w) => w,
          cross: (_w, h) => h / 2,
          default: (w) => w * 0.38,
          max: (w) => w * 0.8,
          mx: pxMx((w) => w),
        }),
      );
      break;
    case 'bracket':
      out.push(
        axisAdjust({
          key: 'bracketArm',
          labelKey: 'bracketArm',
          axis: 'y',
          cross: (w) => w / 2,
          default: (w, h) => Math.min(w * 0.3, h * 0.28),
          max: (_w, h) => h * 0.45,
          mx: pxMx((_w, h) => h),
        }),
      );
      break;
    case 'star':
      out.push(
        axisAdjust({
          key: 'starInner',
          labelKey: 'starInner',
          unit: 'ratio',
          axis: 'x',
          scale: (w) => 1 / Math.max(1, w),
          cross: (_w, h) => h / 2,
          default: () => 0.44,
          min: () => 0.1,
          max: () => 0.9,
          mx: ratioMx(),
        }),
      );
      break;
    case 'laneH':
      out.push(
        axisAdjust({
          key: 'laneHeader',
          labelKey: 'laneHeader',
          axis: 'x',
          cross: (_w, h) => h / 2,
          default: () => SWIMLANE_HEADER_WIDTH,
          min: () => 16,
          max: (w) => Math.max(24, w * 0.5),
          mx: pxMx(() => 1),
        }),
      );
      break;
    case 'laneV':
      out.push(
        axisAdjust({
          key: 'laneHeader',
          labelKey: 'laneHeader',
          axis: 'y',
          cross: (w) => w / 2,
          default: () => SWIMLANE_HEADER_HEIGHT,
          min: () => 16,
          max: (_w, h) => Math.max(24, h * 0.5),
          mx: pxMx(() => 1),
        }),
      );
      break;
    default:
      break;
  }
  return out;
}

/** Internal compartments (decor === 'compartments'): heights of the two separator lines */
const COMPARTMENT_ADJUSTS: ShapeAdjustDef[] = [
  axisAdjust({
    key: 'dividerTop',
    labelKey: 'dividerTop',
    axis: 'y',
    cross: (w) => w / 2,
    default: (_w, h) => h * 0.34,
    min: () => 8,
    max: (_w, h) => h - 8,
    mx: pxMx((_w, h) => h),
  }),
  axisAdjust({
    key: 'dividerBottom',
    labelKey: 'dividerBottom',
    axis: 'y',
    cross: (w) => w / 2,
    default: (_w, h) => h * 0.67,
    min: () => 8,
    max: (_w, h) => h - 8,
  }),
];

/**
 * All adjustable parameters of a shape (derived items + those declared in `ShapeDef.adjust`).
 * Cached per ShapeDef, so the render hot path allocates nothing extra.
 */
export function adjustsFor(def: ShapeDef): ShapeAdjustDef[] {
  const cached = adjustCache.get(def);
  if (cached) return cached;
  const list = [...derivedAdjusts(def), ...(def.adjust ?? [])];
  if (def.decor === 'compartments') list.push(...COMPARTMENT_ADJUSTS);
  adjustCache.set(def, list);
  return list;
}

/** Whether the shape has adjustable parameters (decides whether handles / the panel group are rendered) */
export function hasAdjusts(def: ShapeDef | undefined): boolean {
  return !!def && adjustsFor(def).length > 0;
}

/* ------------------------------ Resolver ------------------------------ */

/**
 * Read a parameter value: prefer `style.shapeParams[key]`, fall back to `foldSize` / `cornerRadius` for legacy drafts,
 * otherwise take the default declared by the shape, and clamp to min/max at the end (with NaN guards).
 */
export function paramValue(
  def: ShapeDef,
  style: Partial<FlowNodeStyle> | undefined,
  key: string,
  w: number,
  h: number,
): number {
  const adj = adjustsFor(def).find((a) => a.key === key);
  const fallback = adj ? adj.default(w, h) : 0;
  let raw = style?.shapeParams?.[key];
  if (raw === undefined) {
    if (key === 'foldSize') raw = style?.foldSize;
    else if (key === 'cornerRadius') raw = style?.cornerRadius;
  }
  if (raw === undefined || !Number.isFinite(raw)) return fallback;
  if (!adj) return raw;
  const min = adj.min(w, h);
  const max = adj.max(w, h);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return fallback;
  return Math.max(min, Math.min(max, raw));
}

/** Build the parameter reader for a shape, shared by the renderer and handles */
export function paramGetterFor(
  def: ShapeDef,
  style: Partial<FlowNodeStyle> | undefined,
  w: number,
  h: number,
): ParamGetter {
  return (key) => paramValue(def, style, key, w, h);
}

/** Pointer position in local coordinates → clamped parameter value (used by canvas dragging) */
export function projectAdjust(
  adj: ShapeAdjustDef,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  const raw = adj.project(x, y, w, h);
  if (!Number.isFinite(raw)) return adj.default(w, h);
  return Math.max(adj.min(w, h), Math.min(adj.max(w, h), raw));
}
