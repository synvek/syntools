/**
 * SVG import.
 *
 * The scope is narrow: **rasterize on import**, not "parse SVG into vector layers".
 * Our document model is bitmap-first; what we need is "turn this vector art into pixels at my sharpness";
 * and SVG is scalable, so two things matter:
 *
 * 1. **work out its intrinsic size** — read `width` / `height` (converting px / pt / cm), else `viewBox`;
 * 2. **supersample** — 2× by default, so scaling the layer after import stays sharp (capped by `MAX_CANVAS_SIZE`).
 *
 * For safety it renders through `<img>` only: in that mode browsers **do not run** SVG scripts or load
 * external resources (so no outbound requests or script injection); failure means "cannot import".
 */

import type { ToolResult } from '@/core/types';
import { MAX_CANVAS_SIZE } from '../core';
import { createCanvasElement, registerCanvas, type LoadedImage } from '../model/assets';

/** Default supersampling factor on import */
export const SVG_DEFAULT_SCALE = 2;

/** CSS absolute units → pixels (1in = 96px) */
const UNIT_TO_PX: Record<string, number> = {
  '': 1,
  px: 1,
  pt: 96 / 72,
  pc: 16,
  mm: 96 / 25.4,
  cm: 96 / 2.54,
  in: 96,
  q: 96 / 101.6,
};

export interface SvgSize {
  width: number;
  height: number;
}

/**
 * Parse a CSS length into pixels; context-dependent lengths (`%` / `auto` / `em`) return null.
 * Negative values? No — a negative SVG size is meaningless and counts as a parse failure.
 */
export function parseSvgLength(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*([a-z%]*)\s*$/i.exec(value);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const factor = UNIT_TO_PX[unit];
  if (factor === undefined) return null;
  return amount * factor;
}

/** `viewBox="minX minY width height"` (comma or space separated) → width and height */
export function parseViewBox(value: string | undefined): SvgSize | null {
  if (!value) return null;
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 4 || parts.some((item) => !Number.isFinite(item))) return null;
  const [, , width, height] = parts;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

/**
 * SVG source → intrinsic size.
 *
 * Attributes come from the `<svg ...>` tag via regex rather than `DOMParser`, so this stays pure-function
 * (prerender included); the three attributes are plain text, and failure simply returns null.
 * Priority matches browsers: valid `width` and `height` win, otherwise `viewBox`.
 */
export function parseSvgIntrinsicSize(source: string): SvgSize | null {
  const tag = /<svg\b([^>]*)>/i.exec(source);
  if (!tag) return null;
  const attributes = new Map<string, string>();
  const attrPattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match = attrPattern.exec(tag[1]);
  while (match) {
    attributes.set(match[1], match[2] ?? match[3] ?? '');
    match = attrPattern.exec(tag[1]);
  }
  // Names are kept as written and matched case-insensitively: lowercasing would lose camelCase `viewBox`
  const read = (name: string) => {
    const target = name.toLowerCase();
    for (const [key, value] of attributes) {
      if (key.toLowerCase() === target) return value;
    }
    return undefined;
  };

  const width = parseSvgLength(read('width'));
  const height = parseSvgLength(read('height'));
  if (width !== null && height !== null) return { width, height };
  return parseViewBox(read('viewBox'));
}

/** Raster size at the given factor; unknown sizes get a conservative default box, all clamped to the cap */
export function svgRasterSize(size: SvgSize | null, scale = SVG_DEFAULT_SCALE): SvgSize {
  const base = size ?? { width: 512, height: 512 };
  const factor = Math.max(1, scale);
  let width = Math.round(base.width * factor);
  let height = Math.round(base.height * factor);
  const longest = Math.max(width, height);
  if (longest > MAX_CANVAS_SIZE) {
    const shrink = MAX_CANVAS_SIZE / longest;
    width = Math.max(1, Math.round(width * shrink));
    height = Math.max(1, Math.round(height * shrink));
  }
  return { width, height };
}

/**
 * SVG text → canvas.
 *
 * Rewrap in a Blob instead of using the File's object URL directly:
 * that way a missing MIME type (some systems export empty ones) still decodes as `image/svg+xml`.
 */
export function rasterizeSvg(
  source: string,
  scale = SVG_DEFAULT_SCALE,
): Promise<HTMLCanvasElement> {
  const raster = svgRasterSize(parseSvgIntrinsicSize(source), scale);
  const blob = new Blob([source], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = createCanvasElement(raster.width, raster.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('CONTEXT_FAILED'));
        return;
      }
      ctx.drawImage(image, 0, 0, raster.width, raster.height);
      resolve(canvas);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG_DECODE_FAILED'));
    };
    image.src = url;
  });
}

/** Read a local SVG file → asset */
export async function loadSvgFile(
  file: File,
  scale = SVG_DEFAULT_SCALE,
): Promise<ToolResult<LoadedImage>> {
  try {
    const source = await file.text();
    const canvas = await rasterizeSvg(source, scale);
    return {
      ok: true,
      value: { assetId: registerCanvas(canvas), width: canvas.width, height: canvas.height },
    };
  } catch {
    return { ok: false, error: 'SVG_DECODE_FAILED' };
  }
}
