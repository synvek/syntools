/**
 * Pure hit-testing for the overlay.
 *
 * Points and rects are normalized (0–1, top-left of the visual page). Object rotation happens in
 * screen space, which is anisotropic when the page is not square, so callers pass
 * `pageAspect = width / height` to make the rotated box test match what the user sees.
 */

import type { NormRect, PdfObject } from '../model/types';

export interface NormPoint {
  x: number;
  y: number;
}

/** Rotate a point expressed in object-local pixels back into world pixels (CSS `rotate` inverse) */
function toLocal(dx: number, dy: number, rotation: number) {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: dx * cos + dy * sin,
    y: -dx * sin + dy * cos,
  };
}

/** True when `point` falls inside `object`, honouring free rotation */
export function pointInObject(point: NormPoint, object: PdfObject, pageAspect = 1): boolean {
  const { rect, rotation } = object;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const local = toLocal((point.x - cx) * pageAspect, point.y - cy, rotation);

  return Math.abs(local.x) <= (rect.w * pageAspect) / 2 && Math.abs(local.y) <= rect.h / 2;
}

/** Topmost object under the point (highest `z` wins), or `null` */
export function hitTest(
  point: NormPoint,
  objects: readonly PdfObject[],
  pageAspect = 1,
): PdfObject | null {
  let hit: PdfObject | null = null;
  for (const object of objects) {
    if (!pointInObject(point, object, pageAspect)) continue;
    if (!hit || object.z >= hit.z) hit = object;
  }
  return hit;
}

export function rectsIntersect(a: NormRect, b: NormRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Objects touched by a marquee.
 *
 * Rotation is approximated by the axis-aligned rect: at handwriting size the difference only shows
 * on near-90° objects, and the escape hatch is a click (which uses the exact test).
 */
export function objectsInRect(marquee: NormRect, objects: readonly PdfObject[]): PdfObject[] {
  return objects
    .filter((object) => rectsIntersect(marquee, object.rect))
    .sort((a, b) => b.z - a.z)
    .map((object) => object);
}
