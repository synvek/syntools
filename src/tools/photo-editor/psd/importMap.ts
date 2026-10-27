import {
  createColorOverlay,
  createDropShadow,
  createInnerShadow,
  createOuterGlow,
  createStroke,
} from '../core';
import type { BlendMode, LayerStyle } from '../model/types';

/**
 * PSD → our model mapping (pure, unit-testable).
 *
 * ag-psd's structures have many mutually optional fields; scattering them through the read flow would
 * become "change one, miss another". Only the **fields we actually read** are declared here, which avoids
 * binding to its full types and lets the mapping be tested without real PSD files.
 */

export type PsdBlendName = string;

/** Our blend modes ↔ PSD names: writing uses the spaced spelling, reading maps back through the table */
const PSD_TO_BLEND: Record<string, BlendMode> = {
  normal: 'normal',
  // PSD's "pass through" isn't a blend mode: reads treat it as normal (the group's own flag carries it)
  'pass through': 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  'soft light': 'soft-light',
  'hard light': 'hard-light',
  darken: 'darken',
  lighten: 'lighten',
  'color dodge': 'color-dodge',
  'color burn': 'color-burn',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
};

export function mapPsdBlendMode(mode: PsdBlendName | undefined): BlendMode {
  return PSD_TO_BLEND[(mode ?? 'normal').toLowerCase()] ?? 'normal';
}

export interface PsdColor {
  r: number;
  g: number;
  b: number;
}

/** PSD color (0~255 components) → `#RRGGBB`; falls back to black */
export function mapPsdColor(color: PsdColor | undefined): string {
  const to = (value: number | undefined) =>
    Math.max(0, Math.min(255, Math.round(value ?? 0)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(color?.r)}${to(color?.g)}${to(color?.b)}`.toUpperCase();
}

export interface PsdDropShadow {
  enabled?: boolean;
  color?: PsdColor;
  opacity?: number;
  angle?: number;
  distance?: { units?: string; value?: number } | number;
  /**
   * "Spread" is called `choke` in PSD descriptors (that's what ag-psd returns),
   * and `spread` is the alias other implementations use; both are accepted.
   */
  choke?: { units?: string; value?: number } | number;
  spread?: { units?: string; value?: number } | number;
  blur?: { units?: string; value?: number } | number;
  size?: { units?: string; value?: number } | number;
}

export interface PsdInnerShadow {
  enabled?: boolean;
  color?: PsdColor;
  opacity?: number;
  angle?: number;
  distance?: { value?: number } | number;
  blur?: { value?: number } | number;
  size?: { value?: number } | number;
}

export interface PsdGlowLike {
  enabled?: boolean;
  color?: PsdColor;
  opacity?: number;
  blur?: { value?: number } | number;
  size?: { value?: number } | number;
}

export interface PsdSolidFill {
  enabled?: boolean;
  color?: PsdColor;
  opacity?: number;
}

export interface PsdStroke {
  enabled?: boolean;
  color?: PsdColor;
  opacity?: number;
  size?: { value?: number } | number;
  position?: string;
}

export interface PsdEffects {
  dropShadow?: PsdDropShadow[];
  innerShadow?: PsdInnerShadow[];
  outerGlow?: PsdGlowLike | PsdGlowLike[];
  solidFill?: PsdSolidFill | PsdSolidFill[];
  stroke?: PsdStroke | PsdStroke[];
}

/** PSD size values are `{ units, value }` (some fields give a plain number instead) */
function sizeOf(value: PsdDropShadow['distance']): number {
  if (typeof value === 'number') return value;
  const raw = value?.value ?? 0;
  return Math.abs(Number.isFinite(raw) ? raw : 0);
}

function first<T extends { enabled?: boolean }>(value: T | T[] | undefined): T | undefined {
  if (Array.isArray(value)) return value.find((item) => item?.enabled !== false) ?? value[0];
  return value;
}

function hexWithAlpha(
  color: PsdColor | undefined,
  opacity: number | undefined,
): {
  color: string;
  opacity: number;
} {
  return {
    color: mapPsdColor(color),
    // ag-psd's opacity is FixedPoint8 in 0~1 (not the percentage PS shows); absent means fully opaque
    opacity: Math.max(0, Math.min(1, opacity ?? 1)),
  };
}

/**
 * Layer effects → layer style.
 *
 * Only the five effects we can **actually render** are mapped; others (pattern overlay / gradient
 * overlay / bevel and emboss…) are silently ignored — reading less beats a half-baked result.
 * Returning null means "this PSD has no layer effects we support".
 */
export function mapPsdEffects(effects: PsdEffects | undefined): LayerStyle | null {
  if (!effects) return null;
  const style: LayerStyle = {};
  const shadow = effects.dropShadow?.find((item) => item.enabled !== false);
  if (shadow) {
    const base = createDropShadow();
    const paint = hexWithAlpha(shadow.color, shadow.opacity);
    style.dropShadow = {
      ...base,
      enabled: true,
      color: paint.color,
      opacity: paint.opacity,
      angle: shadow.angle ?? base.angle,
      distance: sizeOf(shadow.distance),
      spread: sizeOf(shadow.choke ?? shadow.spread),
      size: sizeOf(shadow.blur ?? shadow.size),
    };
  }
  const inner = effects.innerShadow?.find((item) => item.enabled !== false);
  if (inner) {
    const base = createInnerShadow();
    const paint = hexWithAlpha(inner.color, inner.opacity);
    style.innerShadow = {
      ...base,
      enabled: true,
      color: paint.color,
      opacity: paint.opacity,
      angle: inner.angle ?? base.angle,
      distance: sizeOf(inner.distance),
      size: sizeOf(inner.blur ?? inner.size),
    };
  }
  const glow = first(effects.outerGlow);
  if (glow) {
    const base = createOuterGlow();
    const paint = hexWithAlpha(glow.color, glow.opacity);
    style.outerGlow = {
      ...base,
      enabled: true,
      color: paint.color,
      opacity: paint.opacity,
      size: sizeOf(glow.blur ?? glow.size),
    };
  }
  const fill = first(effects.solidFill);
  if (fill) {
    const base = createColorOverlay();
    const paint = hexWithAlpha(fill.color, fill.opacity);
    style.colorOverlay = {
      ...base,
      enabled: true,
      color: paint.color,
      opacity: paint.opacity,
    };
  }
  const stroke = first(effects.stroke);
  if (stroke) {
    const base = createStroke();
    const paint = hexWithAlpha(stroke.color, stroke.opacity);
    style.stroke = {
      ...base,
      enabled: true,
      color: paint.color,
      opacity: paint.opacity,
      size: sizeOf(stroke.size),
      position:
        stroke.position === 'inside' || stroke.position === 'center' ? stroke.position : 'outside',
    };
  }
  return Object.keys(style).length > 0 ? style : null;
}

/** The layer's rectangle (PSD expresses it as left/top/right/bottom) */
export interface PsdBounds {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
}

export interface PsdRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function mapPsdBounds(bounds: PsdBounds | undefined): PsdRect | null {
  if (!bounds) return null;
  const left = Math.round(bounds.left ?? 0);
  const top = Math.round(bounds.top ?? 0);
  const width = Math.round((bounds.right ?? left) - left);
  const height = Math.round((bounds.bottom ?? top) - top);
  if (width <= 0 || height <= 0) return null;
  return { x: left, y: top, width, height };
}
