/**
 * Turning a picked / dropped / pasted bitmap into an overlay object (M3-3).
 *
 * Two rules keep the draft and the saved PDF small:
 * - every bitmap is downsampled to a 2000 px long edge before it reaches the model;
 * - PNG stays PNG (transparency matters for signatures), everything else is re-encoded as JPEG 0.9.
 *
 * `placeImageRect` is pure so the default drop size is unit tested without a canvas.
 */

import type { ToolResult } from '@/core/types';
import { clampNormRect } from '../model/coords';
import type { NormRect } from '../model/types';
import { fitWithin, IMAGE_QUALITY, MAX_IMAGE_EDGE, type PixelSize } from './imageScale';

/** A mis-picked 80 MB TIFF would freeze the tab long before saving; reject it up front */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export interface ImportedImage extends PixelSize {
  dataUrl: string;
}

export interface PlaceImageOptions {
  /** Fraction of the page width an image may occupy (default 45%) */
  maxWidth?: number;
  /** Fraction of the page height an image may occupy (default 60%) */
  maxHeight?: number;
}

/**
 * Default frame for a freshly inserted image: centred, never wider than 45% / taller than 60% of the
 * page, with the natural aspect ratio preserved in *page* space (pages are not square, so the
 * aspect has to be scaled by pageWidth / pageHeight).
 */
export function placeImageRect(
  natural: PixelSize,
  page: PixelSize,
  options: PlaceImageOptions = {},
): NormRect {
  const maxWidth = Math.min(1, Math.max(0.05, options.maxWidth ?? 0.45));
  const maxHeight = Math.min(1, Math.max(0.05, options.maxHeight ?? 0.6));
  const naturalW = Math.max(1, natural.width);
  const naturalH = Math.max(1, natural.height);
  const pageW = Math.max(1, page.width);
  const pageH = Math.max(1, page.height);

  // Normalized height for a given normalized width
  const heightFor = (width: number) => (width * pageW * naturalH) / (naturalW * pageH);

  let w = maxWidth;
  let h = heightFor(w);
  if (h > maxHeight) {
    h = maxHeight;
    w = (h * pageH * naturalW) / (naturalH * pageW);
  }

  w = Math.min(1, Math.max(0.01, w));
  h = Math.min(1, Math.max(0.01, h));
  return clampNormRect({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
}

/** Read a File/Blob as a data URL; rejects with `PROCESS_FAILED` when the reader fails */
function readAsDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof FileReader === 'undefined') {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/** Decode a data URL into an `HTMLImageElement`; `null` when the browser cannot decode it */
function decodeImage(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

/**
 * Downsample a data URL so its long edge fits `maxEdge`.
 *
 * Returns the original URL untouched when no scaling is needed, so a small PNG signature keeps its
 * exact pixels (and its alpha channel) instead of being re-encoded.
 */
export async function downsampleDataUrl(
  dataUrl: string,
  maxEdge: number = MAX_IMAGE_EDGE,
): Promise<ImportedImage | null> {
  const image = await decodeImage(dataUrl);
  if (!image) return null;

  const natural = {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
  };
  if (natural.width <= 0 || natural.height <= 0) return null;

  const target = fitWithin(natural, maxEdge);
  if (target.scale >= 1) return { dataUrl, ...natural };

  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext('2d');
  if (!context) return { dataUrl, ...natural };
  context.drawImage(image, 0, 0, target.width, target.height);

  const isPng = dataUrl.startsWith('data:image/png');
  const encoded = isPng
    ? canvas.toDataURL('image/png')
    : canvas.toDataURL('image/jpeg', IMAGE_QUALITY);
  return { dataUrl: encoded, width: target.width, height: target.height };
}

/** Downsample a picked image file, rejecting non-images and oversized files */
export async function readImageFile(file: File): Promise<ToolResult<ImportedImage>> {
  if (!file.type.startsWith('image/')) return { ok: false, error: 'PROCESS_FAILED' };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: 'TOO_LARGE' };

  const dataUrl = await readAsDataUrl(file);
  if (!dataUrl) return { ok: false, error: 'PROCESS_FAILED' };

  const image = await downsampleDataUrl(dataUrl);
  if (!image) return { ok: false, error: 'PROCESS_FAILED' };
  return { ok: true, value: image };
}

/** Same pipeline for clipboard / drag-and-drop blobs (no file name involved) */
export async function readImageBlob(blob: Blob): Promise<ToolResult<ImportedImage>> {
  if (!blob.type.startsWith('image/')) return { ok: false, error: 'PROCESS_FAILED' };
  if (blob.size > MAX_IMAGE_BYTES) return { ok: false, error: 'TOO_LARGE' };

  const dataUrl = await readAsDataUrl(blob);
  if (!dataUrl) return { ok: false, error: 'PROCESS_FAILED' };
  const image = await downsampleDataUrl(dataUrl);
  if (!image) return { ok: false, error: 'PROCESS_FAILED' };
  return { ok: true, value: image };
}
