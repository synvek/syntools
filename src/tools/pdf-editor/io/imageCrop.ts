/**
 * Image crop math and the save-time resample (M3-3).
 *
 * The model stores a normalized rect over the *source* bitmap; the editor clips the bitmap with CSS
 * and `savePdf` re-crops from the original data URL. Nothing here mutates the stored bitmap, so
 * cropping twice never loses quality.
 */

import type { PdfImageCrop } from '../model/types';

/** A crop smaller than this is unusable as a handle target; also prevents a zero-size bitmap */
export const MIN_CROP = 0.05;

export type CropHandle = 'nw' | 'ne' | 'sw' | 'se';

export interface CropSourceSize {
  width: number;
  height: number;
}

export function fullCrop(): PdfImageCrop {
  return { x: 0, y: 0, w: 1, h: 1 };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Clamp a rect into 0–1 while keeping at least `MIN_CROP` visible in both axes */
export function clampCrop(crop: PdfImageCrop): PdfImageCrop {
  const w = clamp(crop.w, MIN_CROP, 1);
  const h = clamp(crop.h, MIN_CROP, 1);
  return {
    x: clamp(crop.x, 0, 1 - w),
    y: clamp(crop.y, 0, 1 - h),
    w,
    h,
  };
}

/** True when the bitmap is shown whole (within rounding), used to drop the field on reset */
export function isFullCrop(crop: PdfImageCrop): boolean {
  const epsilon = 1e-4;
  return crop.x <= epsilon && crop.y <= epsilon && crop.w >= 1 - epsilon && crop.h >= 1 - epsilon;
}

/** Move the window; the size never changes, so dragging cannot leave the bitmap */
export function moveCrop(crop: PdfImageCrop, dx: number, dy: number): PdfImageCrop {
  const current = clampCrop(crop);
  return clampCrop({ ...current, x: current.x + dx, y: current.y + dy });
}

/**
 * Resize from one corner. `dx`/`dy` are normalized to the displayed bitmap, so the caller converts
 * pointer pixels once and this stays testable without a DOM.
 */
export function resizeCrop(
  crop: PdfImageCrop,
  handle: CropHandle,
  dx: number,
  dy: number,
): PdfImageCrop {
  const current = clampCrop(crop);
  let left = current.x;
  let top = current.y;
  let right = current.x + current.w;
  let bottom = current.y + current.h;

  if (handle === 'nw' || handle === 'sw') left = clamp(left + dx, 0, right - MIN_CROP);
  if (handle === 'ne' || handle === 'se') right = clamp(right + dx, left + MIN_CROP, 1);
  if (handle === 'nw' || handle === 'ne') top = clamp(top + dy, 0, bottom - MIN_CROP);
  if (handle === 'sw' || handle === 'se') bottom = clamp(bottom + dy, top + MIN_CROP, 1);

  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Pixel size of the cropped bitmap (rounded, at least 1×1) */
export function croppedSize(
  natural: CropSourceSize,
  crop: PdfImageCrop,
): { width: number; height: number } {
  const rect = clampCrop(crop);
  return {
    width: Math.max(1, Math.round(Math.max(1, natural.width) * rect.w)),
    height: Math.max(1, Math.round(Math.max(1, natural.height) * rect.h)),
  };
}

/**
 * Re-crop the bitmap with the 9-argument `drawImage`, returning a new data URL.
 *
 * Falls back to the original payload when the platform has no canvas 2D context (jsdom) or the
 * bitmap cannot be decoded: a broken crop must not cost the user their save.
 */
export async function cropImageDataUrl(
  dataUrl: string,
  crop: PdfImageCrop,
  natural: CropSourceSize,
): Promise<string> {
  const rect = clampCrop(crop);
  if (isFullCrop(rect)) return dataUrl;

  const size = croppedSize(natural, rect);
  try {
    const image = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) return dataUrl;

    const sourceX = Math.round(rect.x * image.naturalWidth);
    const sourceY = Math.round(rect.y * image.naturalHeight);
    const sourceW = Math.max(1, Math.round(rect.w * image.naturalWidth));
    const sourceH = Math.max(1, Math.round(rect.h * image.naturalHeight));

    context.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, size.width, size.height);
    const png = canvas.toDataURL('image/png');
    return png === 'data:,' ? dataUrl : png;
  } catch {
    return dataUrl;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('decode failed'));
    image.src = src;
  });
}
