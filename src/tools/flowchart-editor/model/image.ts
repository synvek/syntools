/**
 * Image node asset handling: read a local file as a dataURL and downscale it proportionally to a safe size.
 *
 * Everything happens in the browser (FileReader + canvas), so the image never leaves the device;
 * the downscale is mainly to bound draft size and export/render cost.
 */

import { IMAGE_MAX_EDGE } from './types';

export interface LoadedImage {
  /** dataURL (downscaled when needed) */
  src: string;
  width: number;
  height: number;
}

function readAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Read an image file; downscale proportionally with canvas when it exceeds the maximum edge length.
 * Returns null when the file cannot be decoded (callers report the import failure).
 */
export async function loadImageFile(
  file: File,
  maxEdge = IMAGE_MAX_EDGE,
): Promise<LoadedImage | null> {
  const dataUrl = await readAsDataUrl(file);
  if (!dataUrl) return null;
  const img = await loadImage(dataUrl);
  if (!img) return null;

  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (width === 0 || height === 0) return null;

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  if (scale >= 1) return { src: dataUrl, width, height };

  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { src: dataUrl, width, height };
  ctx.drawImage(img, 0, 0, targetW, targetH);
  // PNG/SVG stay lossless with transparency; other formats (photos) use JPEG to bound size
  const keepAlpha = file.type === 'image/png' || file.type === 'image/svg+xml';
  const src = keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
  return { src, width: targetW, height: targetH };
}

/** Scale proportionally within the given maximum width/height (for fitting an image into a node's default size) */
export function fitInto(
  size: { width: number; height: number },
  box: { width: number; height: number },
): { width: number; height: number } {
  if (size.width <= 0 || size.height <= 0) return { ...box };
  const scale = Math.min(box.width / size.width, box.height / size.height);
  return {
    width: Math.max(24, Math.round(size.width * scale)),
    height: Math.max(24, Math.round(size.height * scale)),
  };
}
