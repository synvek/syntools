import { COLOR_CHANNELS, PALETTE_SIZE, extractChannelData, extractPalette } from '../core';
import type { ChannelView } from '../core';
import { createCanvasElement } from '../model/assets';
import { docSignature } from './composite';
import { compositeDoc } from './export';
import type { PhotoDoc } from '../model/types';

/**
 * Channel rendering: single-channel isolation, channel thumbnails, and "extract a palette from the image".
 *
 * All three build on compositing the whole document first (`compositeDoc`), so results match the canvas and export exactly.
 * The channel view is a **display state**: it only affects what the canvas shows, never layer data.
 */

/** Longest side of a single-channel thumbnail */
const THUMB_MAX = 40;
/** Max sampling side for palette extraction: large images are downscaled first so a few dominant colors do not cost tens of millions of pixels */
const PALETTE_SAMPLE_MAX = 256;

/** Pull a single channel (grayscale) out of the composite */
export function channelCanvas(
  doc: PhotoDoc,
  channel: Exclude<ChannelView, 'rgb'>,
  scale = 1,
): HTMLCanvasElement | null {
  const canvas = compositeDoc(doc, null, scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  extractChannelData(frame.data, channel);
  ctx.putImageData(frame, 0, 0);
  return canvas;
}

/** Canvas for isolated display (full size, consumed directly by the Konva channel layer) */
export function channelViewCanvas(
  doc: PhotoDoc,
  channel: Exclude<ChannelView, 'rgb'>,
): HTMLCanvasElement | null {
  return channelCanvas(doc, channel, 1);
}

const thumbCache = new Map<string, string>();
const THUMB_CACHE_LIMIT = 12;

/** Channel thumbnail (for the panel, dataURL): cached by document signature so the panel does not recomposite on every render */
export function channelThumbnail(doc: PhotoDoc, channel: ChannelView): string {
  const key = `${docSignature(doc)}#${channel}`;
  const cached = thumbCache.get(key);
  if (cached) return cached;
  const scale = Math.min(1, THUMB_MAX / Math.max(doc.width, doc.height));
  const canvas =
    channel === 'rgb'
      ? compositeDoc(doc, null, scale)
      : (channelCanvas(doc, channel, scale) ?? compositeDoc(doc, null, scale));
  const url = canvas.toDataURL('image/png');
  if (thumbCache.size >= THUMB_CACHE_LIMIT) {
    const oldest = thumbCache.keys().next().value;
    if (oldest) thumbCache.delete(oldest);
  }
  thumbCache.set(key, url);
  return url;
}

/** All channels (composite + R/G/B), shown by the panel in this order */
export const CHANNEL_LIST: ChannelView[] = ['rgb', ...COLOR_CHANNELS];

/**
 * Extract the dominant colors of the current composite (for the document palette).
 *
 * Downsampled to `PALETTE_SAMPLE_MAX` before counting, so the cost is independent of canvas size (large images stay smooth).
 */
export function extractDocPalette(doc: PhotoDoc, count = PALETTE_SIZE): string[] {
  const scale = Math.min(1, PALETTE_SAMPLE_MAX / Math.max(doc.width, doc.height));
  const canvas = createCanvasElement(
    Math.max(1, Math.round(doc.width * scale)),
    Math.max(1, Math.round(doc.height * scale)),
  );
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  const composited = compositeDoc(doc, null, scale);
  ctx.drawImage(composited, 0, 0);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return extractPalette(frame.data, count);
}
