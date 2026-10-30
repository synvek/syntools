/**
 * Drawing geometry kernel: unit conversion, DrawingML color correction and the path/geometry
 * value types shared by every editor that draws shapes.
 *
 * Boundary (P2-6): this module must not import from `src/tools/**` and must not touch
 * DOM/Canvas/Konva — the kernel is consumed by slide today and by rich-text/spreadsheet shape
 * layers later, and a Canvas dependency would make it unusable outside the browser.
 */

/* ------------------------------- Units ------------------------------- */

/** 1px = 9525 EMU (96dpi: 1 inch = 914400 EMU = 96px, exact) */
export const EMU_PER_PX = 9525;
/** DrawingML font size is in 1/100 pt */
export const PT_HUNDREDTHS = 100;
/** DrawingML percentage unit: 1000 = 100% */
export const PCT_UNIT = 1000;
/** DrawingML alpha / lumMod unit: 100000 = 100% */
export const ALPHA_UNIT = 100000;

export function emuToPx(emu: number): number {
  return Math.round(emu / EMU_PER_PX);
}

export function pxToEmu(px: number): number {
  return Math.round(px * EMU_PER_PX);
}

/** DrawingML font size (1/100 pt) → points */
export function hundredthsPtToPt(value: number): number {
  return value / 100;
}

/** Points → DrawingML integer font size (1/100 pt) */
export function ptToHundredthsPt(pt: number): number {
  return Math.round(pt * 100);
}

/** pt → px（96dpi：1pt = 4/3 px） */
export function ptToPx(pt: number): number {
  return (pt * 96) / 72;
}

export function pxToPt(px: number): number {
  return (px * 72) / 96;
}

/** DrawingML permille → px */
export function permilleToPx(value: number, base: number): number {
  return (value / PCT_UNIT) * base;
}

/* ------------------------------- Colors ------------------------------- */

export interface ColorTransform {
  lumMod?: number;
  lumOff?: number;
  shade?: number;
  tint?: number;
  /** 0~1 */
  alpha?: number;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace(/^#/, '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Normalize a 6-digit hex color; returns null for invalid input */
export function normalizeHex(input: string | undefined | null): string | null {
  if (!input) return null;
  const text = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(text)) {
    return `#${text
      .split('')
      .map((c) => c + c)
      .join('')
      .toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(text)) return `#${text.toLowerCase()}`;
  return null;
}

/** Correct a color via lumMod/lumOff/shade/tint (equivalent to DrawingML §20.1.2.3) */
export function applyColorTransform(hex: string, tf: ColorTransform = {}): string {
  let [r, g, b] = hexToRgb(hex);
  if (typeof tf.lumMod === 'number' && Number.isFinite(tf.lumMod)) {
    const k = clamp01(tf.lumMod / ALPHA_UNIT);
    r *= k;
    g *= k;
    b *= k;
  }
  if (typeof tf.lumOff === 'number' && Number.isFinite(tf.lumOff)) {
    const k = clamp01(tf.lumOff / ALPHA_UNIT);
    r += 255 * k;
    g += 255 * k;
    b += 255 * k;
  }
  if (typeof tf.shade === 'number' && Number.isFinite(tf.shade)) {
    const k = clamp01(tf.shade / ALPHA_UNIT);
    r *= k;
    g *= k;
    b *= k;
  }
  if (typeof tf.tint === 'number' && Number.isFinite(tf.tint)) {
    const k = clamp01(tf.tint / ALPHA_UNIT);
    r = r * (1 - k) + 255 * k;
    g = g * (1 - k) + 255 * k;
    b = b * (1 - k) + 255 * k;
  }
  return rgbToHex(r, g, b);
}

/** #RRGGBB + alpha → rgba() string (returns the original color when alpha=1) */
export function withAlpha(hex: string, alpha?: number): string {
  if (alpha === undefined || alpha >= 1) return hex;
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha).toFixed(3)})`;
}

/* ------------------------------- Path model ------------------------------- */

/**
 * One command of a DrawingML `a:custGeom` path, in **normalized 0~1** coordinates.
 * Normalized so the shape can be resized without rewriting the path; rendering scales it,
 * export multiplies it back into the `a:path@w/h` space.
 */
export type PathCommand =
  | { c: 'M'; x: number; y: number }
  | { c: 'L'; x: number; y: number }
  | { c: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { c: 'Q'; x1: number; y1: number; x: number; y: number }
  | { c: 'Z' };

/** DrawingML prstGeom → render-ready geometry description */
export interface ShapeGeometry {
  /** Render form: rect (optionally rounded) / ellipse / star / closed polygon / SVG path */
  kind: 'rect' | 'ellipse' | 'star' | 'polygon' | 'path';
  /** Corner radius ratio when kind==='rect' (0~0.5, relative to the short side) */
  radius?: number;
  /** Normalized vertices (0~1), kind==='polygon' */
  points?: number[];
  /** Normalized SVG path, kind==='path' */
  path?: string;
  /**
   * Explicit custom geometry (normalized commands). When present it wins over `prst`,
   * both when rendering and when exporting (`a:custGeom` is written instead of `a:prstGeom`).
   */
  custGeom?: PathCommand[];
  /** Star inner ratio (0~1), kind==='star' */
  innerRatio?: number;
  /**
   * DrawingML adjustment values, keyed `adj1`/`adj2`… and normalized to 0~1.
   * The preset definition (`core/drawing/shapeDefs.ts`) turns them into the render geometry;
   * export writes them to `a:avLst`, import reads them back.
   */
  adj?: Record<string, number>;
  /** Original prstGeom name, written back first on export */
  prst: string;
}
