import { downloadBytes, downloadDataUrl } from '@/core/pdf/download';
import { createCanvasElement } from '../model/assets';
import { maskToSelection } from './brush';
import { encodeGif } from './gif';
import { paintDoc } from './paint';
import { encodePdf } from './pdf';
import { encodeTiff, hasTransparency } from './tiff';
import type { PhotoDoc, Rect, Selection } from '../model/types';

/** Export: composite the document to an offscreen canvas and encode it, leaving the viewport untouched. */

export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'tiff' | 'gif' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  /** 0~1, only applies to jpeg / webp */
  quality: number;
  /** Export only this region (cropped to a selection); defaults to the whole canvas */
  clip?: Rect | null;
  /** pdf only: basis for the page size (72 dpi by default, i.e. 1:1 pixels to points) */
  dpi?: number;
}

const MIME: Record<ExportFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  tiff: 'image/tiff',
  gif: 'image/gif',
  pdf: 'application/pdf',
};

export function exportMime(format: ExportFormat): string {
  return MIME[format];
}

/**
 * Whether the browser can encode it natively.
 *
 * PNG / JPEG / WebP go through `canvas.toBlob` (the built-in encoder: best quality and performance),
 * while TIFF / GIF / PDF have none, so the bytes are written here (see `tiff.ts` / `gif.ts` / `pdf.ts`).
 */
export function isNativeExportFormat(format: ExportFormat): boolean {
  return format === 'png' || format === 'jpeg' || format === 'webp';
}

/** Export extension (for file names): jpeg → jpg, others match the format name */
export function exportExtension(format: ExportFormat): string {
  return format === 'jpeg' ? 'jpg' : format;
}

/** Composite the document: optional crop region and scale (thumbnails use a 0.x scale) */
export function compositeDoc(doc: PhotoDoc, clip?: Rect | null, scale = 1): HTMLCanvasElement {
  const region = clip ?? { x: 0, y: 0, width: doc.width, height: doc.height };
  const canvas = createCanvasElement(region.width * scale, region.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.translate(-region.x, -region.y);
  paintDoc(ctx, doc, { signaturePrefix: 'export' });
  return canvas;
}

export function canvasToDataUrl(canvas: HTMLCanvasElement, options: ExportOptions): string {
  return canvas.toDataURL(MIME[options.format], options.quality);
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  options: ExportOptions,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), MIME[options.format], options.quality);
  });
}

export function exportDoc(doc: PhotoDoc, options: ExportOptions): HTMLCanvasElement {
  return compositeDoc(doc, options.clip ?? null, 1);
}

/** Trigger a browser download directly (the caller assembles the file name) */
export function downloadCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  options: ExportOptions,
): void {
  downloadDataUrl(canvasToDataUrl(canvas, options), filename);
}

/**
 * Export bytes: native formats encode through canvas, TIFF / GIF / PDF through the in-house encoders.
 *
 * Everything returns `Uint8Array`, so callers never worry about whether a format supports toBlob.
 */
export async function encodeExport(
  canvas: HTMLCanvasElement,
  options: ExportOptions,
): Promise<Uint8Array> {
  if (isNativeExportFormat(options.format)) {
    const blob = await canvasToBlob(canvas, options);
    if (blob) return new Uint8Array(await blob.arrayBuffer());
    // Extreme cases (out of memory, etc.): fall back to parsing the data URL so the export still succeeds
    const dataUrl = canvasToDataUrl(canvas, options);
    const comma = dataUrl.indexOf(',');
    return decodeBase64(dataUrl.slice(comma + 1));
  }
  const pixels = readPixels(canvas);
  if (!pixels) return new Uint8Array();
  switch (options.format) {
    case 'tiff':
      return encodeTiff(pixels, { alpha: hasTransparency(pixels) });
    case 'gif':
      return encodeGif(pixels, { alpha: hasTransparency(pixels) });
    case 'pdf':
      return encodePdf(pixels, { dpi: options.dpi ?? 72 });
    default:
      return new Uint8Array();
  }
}

/**
 * Export and trigger the download.
 *
 * Native formats still use a data URL (one less Blob copy); the in-house encoders download a Blob —
 * one path for six formats, so callers don't repeat the branching.
 */
export async function downloadExport(
  canvas: HTMLCanvasElement,
  filename: string,
  options: ExportOptions,
): Promise<void> {
  if (isNativeExportFormat(options.format)) {
    downloadDataUrl(canvasToDataUrl(canvas, options), filename);
    return;
  }
  const bytes = await encodeExport(canvas, options);
  if (bytes.length === 0) return;
  downloadBytes(bytes, filename, exportMime(options.format));
}

/** Read canvas pixels; null when no context is available (callers treat it as an export failure) */
function readPixels(canvas: HTMLCanvasElement): {
  data: ImageData['data'];
  width: number;
  height: number;
} | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: frame.data, width: frame.width, height: frame.height };
}

/** base64 → bytes (only on the fallback path when `toBlob` fails) */
function decodeBase64(input: string): Uint8Array {
  const binary = atob(input);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Bake the selection content into a canvas (masked by its shape; inverted holes are punched out too).
 * Shared by "new layer via copy" and "export selection".
 */
export function rasterizeSelection(doc: PhotoDoc, selection: Selection): HTMLCanvasElement | null {
  const region: Rect = {
    x: Math.round(selection.x),
    y: Math.round(selection.y),
    width: Math.max(1, Math.round(selection.width)),
    height: Math.max(1, Math.round(selection.height)),
  };
  const intersect = {
    x: Math.max(0, region.x),
    y: Math.max(0, region.y),
    width: Math.min(doc.width, region.x + region.width) - Math.max(0, region.x),
    height: Math.min(doc.height, region.y + region.height) - Math.max(0, region.y),
  };
  if (intersect.width < 1 || intersect.height < 1) return null;

  const canvas = compositeDoc(doc, region, 1);
  maskToSelection(canvas, selection, region);
  return canvas;
}

/** Layer thumbnail: at most 48px on the long side, keeping the content's aspect ratio */
export function layerThumbnail(doc: PhotoDoc, clip: Rect, max = 48): string {
  const scale = Math.min(1, max / Math.max(clip.width, clip.height));
  const canvas = compositeDoc(doc, clip, scale);
  return canvas.toDataURL('image/png');
}
