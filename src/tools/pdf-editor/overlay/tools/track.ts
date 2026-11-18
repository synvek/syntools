/**
 * Pointer-track maths behind the annotation tools.
 *
 * Pure functions only: the overlay feeds normalized page coordinates in, and the model gets a rect
 * or a simplified polyline back. Keeping this out of React is what makes "draw → object" testable
 * without synthesizing a whole gesture.
 */

import { clampNormRect } from '../../model/coords';
import type { NormRect } from '../../model/types';
import type { NormPoint } from '../hitTest';

/** Drags smaller than this (≈0.4% of the page) are treated as a click and discarded */
export const MIN_DRAG_SIZE = 0.004;

/** Ink samples closer than this are dropped, so a slow pen does not emit thousands of points */
export const MIN_SAMPLE_DISTANCE = 0.002;

/** Douglas-Peucker tolerance in normalized page units (≈1 px on an 800 px page) */
export const SIMPLIFY_TOLERANCE = 0.0015;

/** Rect spanned by a drag, always positive and inside the page */
export function dragRect(start: NormPoint, end: NormPoint): NormRect {
  return clampNormRect({ x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y });
}

/** True when a drag produced a shape worth creating (not a stray click) */
export function isUsableDrag(rect: NormRect, min = MIN_DRAG_SIZE): boolean {
  return rect.w >= min && rect.h >= min;
}

/** Bounding rect of a polyline; zero-size when the list is empty */
export function trackRect(points: readonly NormPoint[]): NormRect {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return clampNormRect({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
}

/** Drop samples that are too close to the previous one */
export function sampleTrack(
  points: readonly NormPoint[],
  minDistance = MIN_SAMPLE_DISTANCE,
): NormPoint[] {
  const kept: NormPoint[] = [];
  for (const point of points) {
    const previous = kept[kept.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < minDistance) continue;
    kept.push({ ...point });
  }
  return kept;
}

function perpendicularDistance(point: NormPoint, start: NormPoint, end: NormPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / length;
}

/**
 * Douglas-Peucker simplification.
 *
 * A 3-second stroke easily carries 400 samples; the PDF only needs the corners. Endpoints are always
 * kept so the stroke starts and ends where the user did.
 */
export function simplifyTrack(
  points: readonly NormPoint[],
  tolerance = SIMPLIFY_TOLERANCE,
): NormPoint[] {
  if (points.length <= 2) return points.map((point) => ({ ...point }));

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    let farthest = -1;
    let maxDistance = 0;

    for (let index = first + 1; index < last; index += 1) {
      const distance = perpendicularDistance(points[index], points[first], points[last]);
      if (distance > maxDistance) {
        maxDistance = distance;
        farthest = index;
      }
    }

    if (farthest >= 0 && maxDistance > tolerance) {
      keep[farthest] = true;
      stack.push([first, farthest], [farthest, last]);
    }
  }

  return points.filter((_, index) => keep[index]).map((point) => ({ ...point }));
}

/** Full ink pipeline: sample, simplify, and give up on single-point strokes */
export function inkTrack(points: readonly NormPoint[]): NormPoint[] {
  const simplified = simplifyTrack(sampleTrack(points));
  return simplified.length >= 2 ? simplified : [];
}
