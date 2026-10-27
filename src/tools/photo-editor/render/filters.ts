import { activeFilters, buildFilterString, filterParam, needsPixelPass } from '../core';
import { previewScaleFor, scaleFilterParams } from './bakePlan';
import { scheduleFullResBake } from './bakeQueue';
import { applyPixelPassToData } from './pixelPass';
import type { Adjustments, FilterSpec } from '../model/types';

/**
 * Adjustment / filter bake pipeline.
 *
 * Preview and export share one pipeline, so what you see is what you get:
 * 1. `ctx.filter` for the CSS-expressible part: brightness / contrast / saturation / hue / blur / gray / sepia / invert;
 * 2. an ImageData pass for whatever needs per-pixel math:
 *    - adjustments: levels / curves (LUT), color balance, B&W, threshold, gradient map, desaturate, temperature;
 *    - filters: sharpen / USM / motion blur / emboss / edges / noise / pixelate / posterize (`FilterSpec.params`).
 *
 * Results cache by parameter signature, so dragging a slider doesn't rebake unchanged layers.
 */

const CACHE_LIMIT = 24;
const cache = new Map<string, HTMLCanvasElement>();

export function clearBakeCache(): void {
  cache.clear();
}

/** Whether baking is needed at all (with no adjustments / filters the source canvas shows directly) */
function needsBake(adjustments: Adjustments, filters: FilterSpec[]): boolean {
  return (
    Boolean([...cssParts(adjustments), ...filterParts(filters)].join(' ')) ||
    needsPixelPass(adjustments, filters)
  );
}

export function bakeRaster(
  source: HTMLCanvasElement,
  signature: string,
  adjustments: Adjustments,
  filters: FilterSpec[],
): HTMLCanvasElement {
  const cached = cache.get(signature);
  if (cached) return cached;
  const out = renderBake(source, adjustments, filters);

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(signature, out);
  return out;
}

/**
 * Live baking while painting: pixels change every frame but the signature doesn't,
 * so the draw must **bypass the cache**, or the canvas would wait for release (a rev bump) to update.
 * With no adjustments / filters it returns the source canvas, zero copy.
 */
export function bakeRasterLive(
  source: HTMLCanvasElement,
  adjustments: Adjustments,
  filters: FilterSpec[],
  signature = '',
): HTMLCanvasElement {
  if (!needsBake(adjustments, filters)) return source;
  const scale = previewScaleFor(source.width, source.height);
  if (scale < 1 && signature && !cache.has(signature)) {
    // The preview returns a downsampled result first (responsive); the Worker fills in full res afterwards
    scheduleFullResBake({ signature, source, adjustments, filters });
  }
  return renderBake(source, adjustments, filters, scale);
}

function renderBake(
  source: HTMLCanvasElement,
  adjustments: Adjustments,
  filters: FilterSpec[],
  scale = 1,
): HTMLCanvasElement {
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const needsPixels = needsPixelPass(adjustments, filters);
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d', { willReadFrequently: needsPixels });
  if (!ctx) return source;

  const cssFilter = cssFilterOf(adjustments, filters, scale);
  if (cssFilter) ctx.filter = cssFilter;
  ctx.drawImage(source, 0, 0, width, height);
  ctx.filter = 'none';

  if (needsPixels) {
    const frame = ctx.getImageData(0, 0, width, height);
    // When downsampling the preview, radius parameters must scale too, or the image jumps on release
    applyPixelPassToData(width, height, frame.data, adjustments, scaleFilterParams(filters, scale));
    ctx.putImageData(frame, 0, 0);
  }
  return out;
}

/**
 * The CSS filter string (exposed separately because the Worker assembles the same one).
 * `scale` affects only blur radii: a 0.5× preview of radius 8 would otherwise look like radius 16 at full size.
 */
export function cssFilterOf(adjustments: Adjustments, filters: FilterSpec[], scale = 1): string {
  return [...cssParts(adjustments), ...filterParts(filters, scale)].join(' ');
}

/** Store the Worker's full-resolution result in the cache, so the next matching signature hits */
export function putBakeResult(signature: string, canvas: HTMLCanvasElement): void {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(signature, canvas);
}

function cssParts(adjustments: Adjustments): string[] {
  const parts = buildFilterString(adjustments);
  return parts ? [parts] : [];
}

/** The CSS-expressible filter part (enabled filters only); `scale` shrinks blur radii for downsampled previews */
function filterParts(filters: FilterSpec[], scale = 1): string[] {
  const parts: string[] = [];
  for (const spec of activeFilters(filters)) {
    switch (spec.id) {
      case 'grayscale':
        parts.push('grayscale(1)');
        break;
      case 'sepia':
        parts.push('sepia(1)');
        break;
      case 'invert':
        parts.push('invert(1)');
        break;
      case 'blur':
      case 'gaussianBlur': {
        const radius = Math.max(0, filterParam(spec, 'radius') * scale);
        if (radius > 0) parts.push(`blur(${radius}px)`);
        break;
      }
      default:
        break;
    }
  }
  return parts;
}
