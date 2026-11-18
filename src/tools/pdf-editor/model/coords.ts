/**
 * Coordinate math for the PDF editor.
 *
 * Three systems are in play:
 *
 * | Name      | Unit        | Origin                    | Rotation       | Used by                          |
 * | --------- | ----------- | ------------------------- | -------------- | -------------------------------- |
 * | normalized| 0–1         | top-left of the *visual*  | already applied | object model, drag/resize        |
 * | visual pt | PDF points  | bottom-left of the visual | already applied | `beginVisualDraw` CTM drawing    |
 * | raw pt    | PDF points  | bottom-left of the cropBox| *not* applied   | pdf-lib page space, tests        |
 *
 * `pdf-annotate` uses the same normalized convention for its drafts, so the two tools agree on what
 * "top-left, 0–1" means. Save code draws under a rotation-cancelling CTM (visual pt); the raw helpers
 * exist so the mapping itself is unit-tested and can be used when a CTM is not an option.
 *
 * Deliberately does not import `@/core/pdf`: that barrel pulls pdfjs (`render.ts`) into the model
 * layer. `normalizeRotation` is 6 lines and duplicated on purpose.
 */

import type { NormRect, PdfRotation } from './types';

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Raw page geometry: crop-box size before rotation, plus the crop-box origin offset */
export interface PageGeometry {
  /** Width/height of the cropBox as stored in the file (rotation *not* applied) */
  size: Size;
  rotation: PdfRotation;
  /** CropBox left edge; non-zero in cropped or non-origin MediaBox files */
  originX?: number;
  originY?: number;
}

/** Normalize any angle to 0 | 90 | 180 | 270 (same rule as `core/pdf/draw.ts`) */
export function normalizeRotation(angle: number): PdfRotation {
  const a = ((Math.round(angle) % 360) + 360) % 360;
  if (a === 90 || a === 180 || a === 270) return a;
  return 0;
}

/** Size as the viewer sees it (width/height swap for quarter turns) */
export function pageVisualSize(raw: Size, rotation: PdfRotation): Size {
  return rotation === 90 || rotation === 270
    ? { width: raw.height, height: raw.width }
    : { width: raw.width, height: raw.height };
}

/** Normalized rect → visual rect (bottom-left origin, points) */
export function normRectToVisual(rect: NormRect, visual: Size): Rect {
  return {
    x: rect.x * visual.width,
    y: (1 - rect.y - rect.h) * visual.height,
    width: rect.w * visual.width,
    height: rect.h * visual.height,
  };
}

/** Visual rect → normalized rect (inverse of `normRectToVisual`) */
export function visualRectToNorm(rect: Rect, visual: Size): NormRect {
  if (visual.width <= 0 || visual.height <= 0) return { x: 0, y: 0, w: 0, h: 0 };
  return {
    x: rect.x / visual.width,
    y: 1 - (rect.y + rect.height) / visual.height,
    w: rect.width / visual.width,
    h: rect.height / visual.height,
  };
}

/** Normalized point → visual point (bottom-left origin) */
export function normPointToVisual(point: Point, visual: Size): Point {
  return { x: point.x * visual.width, y: (1 - point.y) * visual.height };
}

/** Visual point → normalized point (top-left origin) */
export function visualPointToNorm(point: Point, visual: Size): Point {
  if (visual.width <= 0 || visual.height <= 0) return { x: 0, y: 0 };
  return { x: point.x / visual.width, y: 1 - point.y / visual.height };
}

function rectFromPoints(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/**
 * Visual point → raw page point (rotation applied).
 *
 * For /Rotate 90 the page is displayed rotated clockwise, so the inverse map is `x = W - vy`,
 * `y = vx`; 180 and 270 follow the same corner-tracking derivation (covered by round-trip tests).
 */
export function visualPointToPdfPoint(point: Point, page: PageGeometry): Point {
  const { width: w, height: h } = page.size;
  const ox = page.originX ?? 0;
  const oy = page.originY ?? 0;
  switch (page.rotation) {
    case 90:
      return { x: w - point.y + ox, y: point.x + oy };
    case 180:
      return { x: w - point.x + ox, y: h - point.y + oy };
    case 270:
      return { x: point.y + ox, y: h - point.x + oy };
    default:
      return { x: point.x + ox, y: point.y + oy };
  }
}

/** Raw page point → visual point (inverse of `visualPointToPdfPoint`) */
export function pdfPointToVisualPoint(point: Point, page: PageGeometry): Point {
  const { width: w, height: h } = page.size;
  const ox = page.originX ?? 0;
  const oy = page.originY ?? 0;
  const x = point.x - ox;
  const y = point.y - oy;
  switch (page.rotation) {
    case 90:
      return { x: y, y: w - x };
    case 180:
      return { x: w - x, y: h - y };
    case 270:
      return { x: h - y, y: x };
    default:
      return { x, y };
  }
}

/** Visual rect → raw page rect (used when drawing without a CTM, and for assertions) */
export function visualRectToPdfRect(rect: Rect, page: PageGeometry): Rect {
  const a = visualPointToPdfPoint({ x: rect.x, y: rect.y }, page);
  const b = visualPointToPdfPoint({ x: rect.x + rect.width, y: rect.y + rect.height }, page);
  return rectFromPoints(a, b);
}

/** Raw page rect → visual rect (inverse of `visualRectToPdfRect`) */
export function pdfRectToVisualRect(rect: Rect, page: PageGeometry): Rect {
  const a = pdfPointToVisualPoint({ x: rect.x, y: rect.y }, page);
  const b = pdfPointToVisualPoint({ x: rect.x + rect.width, y: rect.y + rect.height }, page);
  return rectFromPoints(a, b);
}

/** Scale that makes the page fill the available width; `padding` is applied on both sides */
export function fitWidthScale(visual: Size, containerWidth: number, padding = 0): number {
  if (visual.width <= 0) return 1;
  const available = Math.max(0, containerWidth - padding * 2);
  return available / visual.width;
}

/** Scale that fits the whole page; never crops */
export function fitPageScale(visual: Size, container: Size, padding = 0): number {
  if (visual.width <= 0 || visual.height <= 0) return 1;
  const width = Math.max(0, container.width - padding * 2);
  const height = Math.max(0, container.height - padding * 2);
  return Math.min(width / visual.width, height / visual.height);
}

/**
 * Screen pixels → PDF points.
 *
 * `displayWidth` is the page's rendered width at save time, so the factor stays correct at any zoom.
 */
export function pxToPt(displayWidth: number, pageWidth: number): number {
  if (displayWidth <= 0) return 1;
  return pageWidth / displayWidth;
}

/** Keep a rect inside the page and give it a positive size (drag can produce inverted rects) */
export function clampNormRect(rect: NormRect): NormRect {
  const left = clamp01(Math.min(rect.x, rect.x + rect.w));
  const top = clamp01(Math.min(rect.y, rect.y + rect.h));
  const right = clamp01(Math.max(rect.x, rect.x + rect.w));
  const bottom = clamp01(Math.max(rect.y, rect.y + rect.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
