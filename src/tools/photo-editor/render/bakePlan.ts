import { activeFilters } from '../core';
import type { FilterId, FilterSpec } from '../model/types';

/**
 * Bake performance policy (pure logic, unit-testable).
 *
 * All three decisions live here, with no DOM involved:
 * 1. **Preview downsampling**: while painting / dragging, bake at a lower resolution (pixel count falls
 *    with the square) and switch to full resolution at rest; 2. **filter params scale with zoom**
 *    (`scaleFilterParams`): radius-like params must track the zoom, or "0.5× preview + radius 8" looks like
 *    "full res + radius 4"; 3. **async worth it**: only when pixels × filter cost clears the threshold.
 */

/** Above this pixel count live preview starts downsampling (about 2 MP ≈ 1414²) */
const PREVIEW_PIXEL_BUDGET = 2_000_000;
/** Lowest preview scale: any lower and you can no longer see what you are drawing */
const MIN_PREVIEW_SCALE = 0.35;

/** Resolution scale used for live baking */
export function previewScaleFor(width: number, height: number): number {
  const pixels = Math.max(1, width) * Math.max(1, height);
  if (pixels <= PREVIEW_PIXEL_BUDGET) return 1;
  const scale = Math.sqrt(PREVIEW_PIXEL_BUDGET / pixels);
  return Math.max(MIN_PREVIEW_SCALE, Math.round(scale * 100) / 100);
}

/**
 * Scale filter parameters to the zoom level.
 *
 * Only **lengths** are scaled (blur radius / motion-blur distance / pixelate cell size); angles and percentages
 * stay as-is. `size` is the "noise scale" for clouds (larger = smoother), so it is scaled too to stay consistent.
 */
export function scaleFilterParams(filters: FilterSpec[], scale: number): FilterSpec[] {
  if (scale >= 0.999) return filters;
  const ratio = Math.max(0.05, scale);
  return filters.map((spec) => {
    if (!spec.params) return spec;
    const params: Record<string, number> = {};
    for (const [key, value] of Object.entries(spec.params)) {
      const isLength = key === 'radius' || key === 'distance' || key === 'size';
      const isBlock = key === 'block' && spec.id === 'pixelate';
      params[key] = isLength || isBlock ? Math.max(1, Math.round(value * ratio)) : value;
    }
    return { ...spec, params };
  });
}

/** Relative cost of each filter (≈ operations per pixel), used to decide whether async is worthwhile */
const FILTER_COST: Partial<Record<FilterId, number>> = {
  reduceNoise: 40,
  motionBlur: 12,
  unsharp: 8,
  gaussianBlur: 6,
  blur: 6,
  clouds: 10,
  twirl: 6,
  spherize: 6,
  pinch: 6,
  lensFlare: 4,
  findEdges: 4,
  traceContour: 4,
  emboss: 3,
  edge: 3,
  sharpen: 3,
  noise: 1,
  pixelate: 2,
  posterize: 1,
};

/** Estimated pixel workload (pixel count × sum of filter costs) */
export function estimatePixelWork(width: number, height: number, filters: FilterSpec[]): number {
  const pixels = Math.max(1, width) * Math.max(1, height);
  let cost = 0;
  for (const spec of activeFilters(filters)) cost += FILTER_COST[spec.id] ?? 1;
  return pixels * Math.max(1, cost);
}

/** Above this workload it is worth handing to the Worker (about 60 M pixel operations) */
export const OFFLOAD_WORK_THRESHOLD = 60_000_000;

export function shouldOffloadPixels(width: number, height: number, filters: FilterSpec[]): boolean {
  return estimatePixelWork(width, height, filters) >= OFFLOAD_WORK_THRESHOLD;
}
