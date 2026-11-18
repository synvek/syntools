/**
 * Selection frame geometry: eight resize handles, the rotate handle position, and the pure math that
 * turns a pointer delta into a new normalized rect / angle.
 *
 * Kept free of React so the behaviour is unit-testable at 0°/90°/180°/270° and with non-square pages.
 */

import { clampNormRect } from '../model/coords';
import type { NormRect } from '../model/types';
import type { NormPoint } from './hitTest';

export const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
export type ResizeHandle = (typeof RESIZE_HANDLES)[number];

export const MIN_OBJECT_SIZE = 0.01;

/** Handle anchor in normalized page space (same order as `RESIZE_HANDLES`) */
export function handlePoint(rect: NormRect, handle: ResizeHandle): NormPoint {
  const west = handle.includes('w');
  const east = handle.includes('e');
  const north = handle.includes('n');
  const south = handle.includes('s');

  const x = west ? rect.x : east ? rect.x + rect.w : rect.x + rect.w / 2;
  const y = north ? rect.y : south ? rect.y + rect.h : rect.y + rect.h / 2;
  return { x, y };
}

export interface ResizeOptions {
  /** Keep the original aspect ratio (Shift); corners only */
  preserveAspect?: boolean;
  /** Minimum width/height in normalized units */
  min?: number;
}

/**
 * Apply a pointer delta (normalized) to the dragged handle.
 *
 * Edges are clamped to the page and never cross the opposite edge, so a resize can shrink an object
 * to `min` but never invert it.
 */
export function resizeRect(
  rect: NormRect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  options: ResizeOptions = {},
): NormRect {
  const min = options.min ?? MIN_OBJECT_SIZE;
  let { x, y, w, h } = rect;

  if (handle.includes('w')) {
    const right = rect.x + rect.w;
    const nextX = Math.min(Math.max(0, rect.x + dx), right - min);
    x = nextX;
    w = right - nextX;
  } else if (handle.includes('e')) {
    const nextRight = Math.max(Math.min(1, rect.x + rect.w + dx), rect.x + min);
    w = nextRight - rect.x;
  }

  if (handle.includes('n')) {
    const bottom = rect.y + rect.h;
    const nextY = Math.min(Math.max(0, rect.y + dy), bottom - min);
    y = nextY;
    h = bottom - nextY;
  } else if (handle.includes('s')) {
    const nextBottom = Math.max(Math.min(1, rect.y + rect.h + dy), rect.y + min);
    h = nextBottom - rect.y;
  }

  if (options.preserveAspect && handle.length === 2 && rect.w > 0 && rect.h > 0) {
    const ratio = rect.w / rect.h;
    // Anchor the opposite corner and let the dominant axis drive the size
    if (Math.abs(w - rect.w) >= Math.abs(h - rect.h)) {
      h = Math.min(1, Math.max(min, w / ratio));
    } else {
      w = Math.min(1, Math.max(min, h * ratio));
    }
    if (handle.includes('w')) x = Math.min(x, rect.x + rect.w - w);
    if (handle.includes('n')) y = Math.min(y, rect.y + rect.h - h);
    if (handle.includes('e')) x = rect.x;
    if (handle.includes('s')) y = rect.y;
    if (handle.includes('e')) w = Math.min(w, 1 - rect.x);
    if (handle.includes('s')) h = Math.min(h, 1 - rect.y);
  }

  return clampNormRect({ x, y, w, h });
}

/**
 * Angle (0–360, clockwise) of `point` around `center`, where 0° points up.
 *
 * `pageAspect` keeps the handle following the pointer on non-square pages.
 */
export function angleFromCenter(center: NormPoint, point: NormPoint, pageAspect = 1): number {
  const dx = (point.x - center.x) * pageAspect;
  const dy = point.y - center.y;
  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  return ((degrees % 360) + 360) % 360;
}

/** Snap a free angle to 15° steps (Shift while rotating) */
export function snapAngle(angle: number, step = 15): number {
  const snapped = Math.round(angle / step) * step;
  return ((snapped % 360) + 360) % 360;
}

/**
 * Rotate a normalized pointer delta into the object's local (unrotated) frame.
 *
 * Width and height use different scales (the page is rarely square), so the delta is converted to
 * pixels, rotated there, and converted back.
 */
export function rotateDelta(dx: number, dy: number, rotation: number, pageAspect = 1) {
  if (!rotation) return { dx, dy };
  const aspect = pageAspect || 1;
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const worldX = dx * aspect;
  const worldY = dy;
  return {
    dx: (worldX * cos + worldY * sin) / aspect,
    dy: -worldX * sin + worldY * cos,
  };
}
