import type { PhotoDoc } from '../model/types';
import { compositeDoc } from '../render/export';

/**
 * Edge snapping for the magnetic lasso.
 *
 * Approach: when the gesture starts, flatten the document into a small composite and compute a normalized
 * gradient magnitude with the Sobel operator; while dragging, the cursor **snaps to the strongest nearby
 * gradient**, so the lasso hugs the contour instead of relying purely on hand-eye coordination.
 *
 * Computed once (not per frame): the document does not change during the gesture, so recomputing is pure
 * waste; downscaling to 512 px also keeps each lookup window within a few thousand pixels.
 */

/** Maximum side length of the gradient map: enough to find edges without slowing the first frame */
const MAX_EDGE_SIZE = 512;

export interface EdgeMap {
  width: number;
  height: number;
  /** Ratio from document coordinates to gradient-map coordinates */
  scale: number;
  /** Normalized gradient magnitude (0..1) */
  magnitude: Float32Array;
}

export function buildEdgeMap(doc: PhotoDoc): EdgeMap {
  const scale = Math.min(1, MAX_EDGE_SIZE / Math.max(1, Math.max(doc.width, doc.height)));
  const width = Math.max(1, Math.round(doc.width * scale));
  const height = Math.max(1, Math.round(doc.height * scale));
  const magnitude = new Float32Array(width * height);
  const empty: EdgeMap = { width, height, scale, magnitude };

  const canvas = compositeDoc(doc, null, scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return empty;
  const { data } = ctx.getImageData(0, 0, width, height);

  // Luminance: transparent pixels count as 0, so the "layer against transparent background" boundary is an edge too
  const luma = new Float32Array(width * height);
  for (let i = 0; i < luma.length; i += 1) {
    const offset = i * 4;
    luma[i] =
      (data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114) *
      (data[offset + 3] / 255);
  }

  let max = 0;
  for (let y = 1; y < height - 1; y += 1) {
    const row = y * width;
    for (let x = 1; x < width - 1; x += 1) {
      const i = row + x;
      const gx =
        -luma[i - width - 1] -
        2 * luma[i - 1] -
        luma[i + width - 1] +
        luma[i - width + 1] +
        2 * luma[i + 1] +
        luma[i + width + 1];
      const gy =
        -luma[i - width - 1] -
        2 * luma[i - width] -
        luma[i - width + 1] +
        luma[i + width - 1] +
        2 * luma[i + width] +
        luma[i + width + 1];
      const value = Math.hypot(gx, gy);
      magnitude[i] = value;
      if (value > max) max = value;
    }
  }
  if (max > 0) for (let i = 0; i < magnitude.length; i += 1) magnitude[i] /= max;
  return { width, height, scale, magnitude };
}

/**
 * Snap document coordinates to a nearby strong edge.
 *
 * - `radius`: search radius in document pixels (the "width" field in the tool options bar)
 * - `contrast`: contrast threshold 0..100 (higher accepts only hard edges, so low-contrast areas are not snapped)
 *
 * When no edge meets the threshold, the input is returned unchanged so the path stays continuous across smooth areas.
 */
export function snapToEdge(
  map: EdgeMap,
  point: { x: number; y: number },
  radius: number,
  contrast: number,
): { x: number; y: number } {
  const threshold = Math.max(0.02, Math.min(0.9, (contrast / 100) * 0.75));
  const cx = point.x * map.scale;
  const cy = point.y * map.scale;
  const searchRadius = Math.max(1, radius * map.scale);

  let best = -1;
  let bx = cx;
  let by = cy;
  const r = Math.ceil(searchRadius);
  for (let dy = -r; dy <= r; dy += 1) {
    const py = Math.round(cy + dy);
    if (py < 1 || py >= map.height - 1) continue;
    for (let dx = -r; dx <= r; dx += 1) {
      const px = Math.round(cx + dx);
      if (px < 1 || px >= map.width - 1) continue;
      const value = map.magnitude[py * map.width + px];
      if (value <= threshold) continue;
      const distance = Math.hypot(dx, dy);
      if (distance > searchRadius) continue;
      // Stronger edges win, but at equal strength prefer the closer point so the polyline is not yanked far away
      const score = value - (distance / searchRadius) * 0.35;
      if (score > best) {
        best = score;
        bx = px;
        by = py;
      }
    }
  }
  return best < 0 ? point : { x: bx / map.scale, y: by / map.scale };
}
