/**
 * Image sizing helpers shared by the overlay (insert preview) and the save pipeline.
 *
 * Phone photos are 4000+ px wide; embedding them as-is multiplies the PDF size and the raster cache
 * for no visible gain (2000 px already prints at 300 dpi on A4). Everything here is pure so the
 * decision is unit tested without a canvas.
 */

export interface PixelSize {
  width: number;
  height: number;
}

/** Longest edge kept when embedding a photo or a signature scan */
export const MAX_IMAGE_EDGE = 2000;

/** JPEG quality used when the browser has to re-encode (canvas export, M3 crop) */
export const IMAGE_QUALITY = 0.9;

export type ImageFormat = 'png' | 'jpg';

/**
 * Scale a bitmap down so its longest edge fits `max`; never upscales.
 *
 * Returns integer pixels (fractional image sizes are rounded by canvas anyway) and the factor that
 * was applied, so callers can reuse it for the canvas transform.
 */
export function fitWithin(
  size: PixelSize,
  max: number = MAX_IMAGE_EDGE,
): PixelSize & { scale: number } {
  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);
  const longest = Math.max(width, height);
  if (longest <= max) return { width: Math.round(width), height: Math.round(height), scale: 1 };

  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

/**
 * Data URL → the pdf-lib embedder to use.
 *
 * `null` means "not an image we can embed"; the caller skips the object instead of failing the save
 * (a broken pasted image must never cost the user their annotations).
 */
export function imageFormat(dataUrl: string): ImageFormat | null {
  if (dataUrl.startsWith('data:image/png')) return 'png';
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'jpg';
  return null;
}

/** Box an image occupies inside `frame` according to its fit mode, centred on the frame */
export function fittedBox(
  frame: { width: number; height: number },
  natural: PixelSize,
  fit: 'contain' | 'cover' | 'fill',
): { width: number; height: number; offsetX: number; offsetY: number } {
  if (fit === 'fill') {
    return { width: frame.width, height: frame.height, offsetX: 0, offsetY: 0 };
  }

  const naturalW = Math.max(1, natural.width);
  const naturalH = Math.max(1, natural.height);
  const scale =
    fit === 'cover'
      ? Math.max(frame.width / naturalW, frame.height / naturalH)
      : Math.min(frame.width / naturalW, frame.height / naturalH);
  const width = naturalW * scale;
  const height = naturalH * scale;

  return {
    width,
    height,
    offsetX: (frame.width - width) / 2,
    offsetY: (frame.height - height) / 2,
  };
}
