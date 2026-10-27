import { SELECTIVE_RANGES } from '../core';
import type {
  ChannelMixerParams,
  PhotoFilterParams,
  ReplaceColorParams,
  SelectiveColorParams,
  SelectiveRange,
  ShadowsHighlightsParams,
} from '../model/types';

/**
 * Per-pixel "more adjustments" (P1-C2): photo filter / channel mixer / shadows & highlights / selective / replace.
 *
 * Same split as `render/adjust.ts`: pure pixel math here; caching and the pipeline belong to `render/filters.ts`.
 * Every function rewrites a `Uint8ClampedArray` in place, so it can be unit-tested without a canvas.
 */

/** Clamp to 0~255 (same semantics as adjust.ts; duplicated to avoid a private cross-module dependency) */
function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function luminance(r: number, g: number, b: number): number {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function parseHex(hex: string): [number, number, number] {
  const value = String(hex).trim().replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [0, 0, 0];
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** RGB (0~255) → HSL (h 0~360, s/l 0~1) */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta < 1e-6) return [0, 0, l];
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

/** HSL → RGB (0~255); h accepts any angle (normalized automatically) */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = (((h % 360) + 360) % 360) / 60;
  const sat = clamp01(s);
  const light = clamp01(l);
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs((hue % 2) - 1));
  const m = light - c / 2;
  const segment = Math.floor(hue) % 6;
  const triplet: [number, number, number] =
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
  return [
    clampByte((triplet[0] + m) * 255),
    clampByte((triplet[1] + m) * 255),
    clampByte((triplet[2] + m) * 255),
  ];
}

/** RGB → CMYK (0~1) */
export function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k >= 1) return [0, 0, 0, 1];
  return [(1 - rn - k) / (1 - k), (1 - gn - k) / (1 - k), (1 - bn - k) / (1 - k), k];
}

/** CMYK (0~1) → RGB (0~255) */
export function cmykToRgb(c: number, m: number, y: number, k: number): [number, number, number] {
  return [
    clampByte((1 - c) * (1 - k) * 255),
    clampByte((1 - m) * (1 - k) * 255),
    clampByte((1 - y) * (1 - k) * 255),
  ];
}

/** Center hues of the six chromatic ranges (degrees) */
const RANGE_CENTERS: Partial<Record<SelectiveRange, number>> = {
  reds: 0,
  yellows: 60,
  greens: 120,
  cyans: 180,
  blues: 240,
  magentas: 300,
};

/** Hue half-width of a chromatic range: a ±60° triangular window, so neighbors overlap naturally */
const RANGE_HALF_WIDTH = 60;

/**
 * Range membership weight (0~1).
 *
 * - the six chromatic ranges: a ±60° triangular window around the center hue, times a saturation gate
 *   (near-gray pixels shouldn't be affected); white / neutral / black: judged by saturation and lightness.
 */
export function selectiveWeight(range: SelectiveRange, h: number, s: number, l: number): number {
  if (range === 'whites') return clamp01(1 - s * 2) * clamp01((l - 0.5) * 2);
  if (range === 'neutrals') return clamp01(1 - s * 2) * clamp01(1 - Math.abs(l - 0.5) * 2);
  if (range === 'blacks') return clamp01(1 - s * 2) * clamp01((0.5 - l) * 2);
  const center = RANGE_CENTERS[range];
  if (center === undefined) return 0;
  const delta = ((h - center + 540) % 360) - 180;
  return clamp01(1 - Math.abs(delta) / RANGE_HALF_WIDTH) * clamp01(s * 2);
}

/**
 * Photo filter: interpolate the whole image toward the filter color, optionally preserving luminosity.
 * `preserveLuminosity` scales everything back to the original luminance (predictable, though it may clip).
 */
export function applyPhotoFilter(data: Uint8ClampedArray, params: PhotoFilterParams): void {
  const [fr, fg, fb] = parseHex(params.color);
  const t = clamp01(params.density / 100);
  if (t === 0) return;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let nr = r + (fr - r) * t;
    let ng = g + (fg - g) * t;
    let nb = b + (fb - b) * t;
    if (params.preserveLuminosity) {
      const before = luminance(r, g, b);
      const after = luminance(nr, ng, nb);
      if (after > 1e-3) {
        const k = before / after;
        nr *= k;
        ng *= k;
        nb *= k;
      }
    }
    data[i] = clampByte(nr);
    data[i + 1] = clampByte(ng);
    data[i + 2] = clampByte(nb);
  }
}

/** Channel mixer: coefficients are percentages, constants are percentage points (×2.55) */
export function applyChannelMixer(data: Uint8ClampedArray, params: ChannelMixerParams): void {
  const row = (values: number[]): [number, number, number, number] => [
    values[0] ?? 0,
    values[1] ?? 0,
    values[2] ?? 0,
    values[3] ?? 0,
  ];
  const red = row(params.red);
  const green = row(params.green);
  const blue = row(params.blue);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    data[i] = clampByte((r * red[0] + g * red[1] + b * red[2]) / 100 + red[3] * 2.55);
    data[i + 1] = clampByte((r * green[0] + g * green[1] + b * green[2]) / 100 + green[3] * 2.55);
    data[i + 2] = clampByte((r * blue[0] + g * blue[1] + b * blue[2]) / 100 + blue[3] * 2.55);
  }
}

/**
 * Shadows / highlights: lift darks weighted by `(1 - luminance)²`, pull down brights weighted by `luminance²`.
 * Simplified: no radius or local contrast (the full PS version needs a blur pass).
 */
export function applyShadowsHighlights(
  data: Uint8ClampedArray,
  params: ShadowsHighlightsParams,
): void {
  const shadows = clamp01(params.shadows / 100) * 0.5;
  const highlights = clamp01(params.highlights / 100) * 0.5;
  if (shadows === 0 && highlights === 0) return;
  for (let i = 0; i < data.length; i += 4) {
    const level = luminance(data[i], data[i + 1], data[i + 2]) / 255;
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    if (shadows > 0) {
      const weight = (1 - level) * (1 - level) * shadows;
      r += (255 - r) * weight;
      g += (255 - g) * weight;
      b += (255 - b) * weight;
    }
    if (highlights > 0) {
      const weight = level * level * highlights;
      r -= r * weight;
      g -= g * weight;
      b -= b * weight;
    }
    data[i] = clampByte(r);
    data[i + 1] = clampByte(g);
    data[i + 2] = clampByte(b);
  }
}

/** Selective color: add the CMYK offset to pixels by range weight (absolute mode) */
export function applySelectiveColor(data: Uint8ClampedArray, params: SelectiveColorParams): void {
  const active: SelectiveRange[] = SELECTIVE_RANGES.filter((range) =>
    (params.ranges[range] ?? []).some((value) => value !== 0),
  );
  if (active.length === 0) return;
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    let dc = 0;
    let dm = 0;
    let dy = 0;
    let dk = 0;
    for (const range of active) {
      const weight = selectiveWeight(range, h, s, l);
      if (weight <= 0) continue;
      const [c, m, y, k] = params.ranges[range] ?? [0, 0, 0, 0];
      dc += (c / 100) * weight;
      dm += (m / 100) * weight;
      dy += (y / 100) * weight;
      dk += (k / 100) * weight;
    }
    if (dc === 0 && dm === 0 && dy === 0 && dk === 0) continue;
    const [c0, m0, y0, k0] = rgbToCmyk(data[i], data[i + 1], data[i + 2]);
    const [nr, ng, nb] = cmykToRgb(
      clamp01(c0 + dc),
      clamp01(m0 + dm),
      clamp01(y0 + dy),
      clamp01(k0 + dk),
    );
    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }
}

/** Replace color: shift HSL for pixels within the tolerance, with a smooth falloff at the edge */
export function applyReplaceColor(data: Uint8ClampedArray, params: ReplaceColorParams): void {
  if (params.hue === 0 && params.saturation === 0 && params.lightness === 0) return;
  const [tr, tg, tb] = parseHex(params.color);
  const fuzziness = Math.max(1, params.fuzziness);
  for (let i = 0; i < data.length; i += 4) {
    const distance = Math.max(
      Math.abs(data[i] - tr),
      Math.abs(data[i + 1] - tg),
      Math.abs(data[i + 2] - tb),
    );
    if (distance > fuzziness) continue;
    const strength = 1 - distance / fuzziness;
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const [nr, ng, nb] = hslToRgb(
      h + params.hue * strength,
      s + (params.saturation / 100) * strength,
      l + (params.lightness / 100) * strength,
    );
    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }
}
