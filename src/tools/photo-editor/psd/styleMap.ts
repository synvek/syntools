import { hexToRgb } from '../core';
import type { LayerStyle } from '../model/types';

/**
 * Layer styles → PSD layer effects (write-side mapping, pure functions).
 *
 * Symmetric to the read direction in `./importMap.ts`: reading maps PSD names → our values, writing goes the other way.
 *
 * Two **unit traps** (both covered by "write → read back through ag-psd → map" round-trip tests):
 * 1. ag-psd's `opacity` uses `FixedPoint8` and takes **0~1**, not the percentage shown in the PS UI;
 * 2. size fields must be `{ units: 'Pixels', value }`; a bare number is serialized as 0.
 */

/** Only the fields we write are declared, to avoid binding ag-psd's full types (still imported dynamically at runtime) */
export interface PsdEffectColor {
  r: number;
  g: number;
  b: number;
}

export interface PsdUnitsValue {
  units: 'Pixels';
  value: number;
}

export interface PsdShadowEffect {
  present: boolean;
  showInDialog: boolean;
  enabled: boolean;
  size: PsdUnitsValue;
  angle: number;
  distance: PsdUnitsValue;
  color: PsdEffectColor;
  blendMode: string;
  opacity: number;
  useGlobalLight: boolean;
  antialiased: boolean;
  choke?: PsdUnitsValue;
  layerConceals?: boolean;
}

export interface PsdGlowEffect {
  present: boolean;
  showInDialog: boolean;
  enabled: boolean;
  size: PsdUnitsValue;
  color: PsdEffectColor;
  blendMode: string;
  opacity: number;
  source: 'edge' | 'center';
  antialiased: boolean;
  range: number;
}

export interface PsdSolidFillEffect {
  present: boolean;
  showInDialog: boolean;
  enabled: boolean;
  blendMode: string;
  color: PsdEffectColor;
  opacity: number;
}

export interface PsdStrokeEffect {
  present: boolean;
  showInDialog: boolean;
  enabled: boolean;
  size: PsdUnitsValue;
  position: 'inside' | 'center' | 'outside';
  fillType: 'color';
  blendMode: string;
  opacity: number;
  color: PsdEffectColor;
  overprint: boolean;
}

export interface PsdLayerEffects {
  disabled?: boolean;
  dropShadow?: PsdShadowEffect[];
  innerShadow?: PsdShadowEffect[];
  outerGlow?: PsdGlowEffect;
  solidFill?: PsdSolidFillEffect[];
  stroke?: PsdStrokeEffect[];
}

const pixels = (value: number): PsdUnitsValue => ({
  units: 'Pixels',
  value: Math.max(0, Math.round(value)),
});

function colorOf(hex: string): PsdEffectColor {
  const parsed = hexToRgb(hex);
  // Fall back to black when parsing fails: better a black effect in PS than an invalid descriptor that will not open
  return parsed ? { r: parsed.r, g: parsed.g, b: parsed.b } : { r: 0, g: 0, b: 0 };
}

const clampOpacity = (value: number) =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 1));

/**
 * Layer styles → PSD layer effects.
 *
 * Only the five effects we **actually render** are written; effects with `enabled: false` are written as
 * "present but disabled" rather than dropped — turning an effect off is temporary, so its parameters should be kept.
 * When every effect is empty this returns `undefined` so ag-psd skips the `lfx2` block entirely.
 */
export function toPsdEffects(style: LayerStyle | null | undefined): PsdLayerEffects | undefined {
  if (!style) return undefined;
  const effects: PsdLayerEffects = {};

  const shadow = style.dropShadow;
  if (shadow) {
    effects.dropShadow = [
      {
        present: true,
        showInDialog: true,
        enabled: shadow.enabled,
        size: pixels(shadow.size),
        angle: shadow.angle,
        distance: pixels(shadow.distance),
        color: colorOf(shadow.color),
        // Our drop shadow composites straight over alpha (equivalent to normal blend); multiply would look darker in PS
        blendMode: 'normal',
        opacity: clampOpacity(shadow.opacity),
        useGlobalLight: false,
        antialiased: true,
        choke: pixels(shadow.spread),
        layerConceals: true,
      },
    ];
  }

  const inner = style.innerShadow;
  if (inner) {
    effects.innerShadow = [
      {
        present: true,
        showInDialog: true,
        enabled: inner.enabled,
        size: pixels(inner.size),
        angle: inner.angle,
        distance: pixels(inner.distance),
        color: colorOf(inner.color),
        blendMode: 'normal',
        opacity: clampOpacity(inner.opacity),
        useGlobalLight: false,
        antialiased: true,
      },
    ];
  }

  const glow = style.outerGlow;
  if (glow) {
    effects.outerGlow = {
      present: true,
      showInDialog: true,
      enabled: glow.enabled,
      size: pixels(glow.size),
      color: colorOf(glow.color),
      blendMode: 'normal',
      opacity: clampOpacity(glow.opacity),
      source: 'edge',
      antialiased: true,
      range: 50,
    };
  }

  const overlay = style.colorOverlay;
  if (overlay) {
    effects.solidFill = [
      {
        present: true,
        showInDialog: true,
        enabled: overlay.enabled,
        blendMode: 'normal',
        color: colorOf(overlay.color),
        opacity: clampOpacity(overlay.opacity),
      },
    ];
  }

  const stroke = style.stroke;
  if (stroke) {
    effects.stroke = [
      {
        present: true,
        showInDialog: true,
        enabled: stroke.enabled,
        size: pixels(stroke.size),
        position: stroke.position,
        fillType: 'color',
        blendMode: 'normal',
        opacity: clampOpacity(stroke.opacity),
        color: colorOf(stroke.color),
        overprint: false,
      },
    ];
  }

  return hasAnyEffect(effects) ? effects : undefined;
}

function hasAnyEffect(effects: PsdLayerEffects): boolean {
  return Boolean(
    effects.dropShadow ||
    effects.innerShadow ||
    effects.outerGlow ||
    effects.solidFill ||
    effects.stroke,
  );
}
