import { downloadDataUrl } from '@/core/pdf/download';
import { createCanvasElement } from '../model/assets';
import { paintDoc } from './paint';
import type { PhotoDoc, Rect } from '../model/types';

/** 导出：把文档合成到离屏画布再编码，不改动用户视口与缩放。 */

export type ExportFormat = 'png' | 'jpeg' | 'webp';

export interface ExportOptions {
  format: ExportFormat;
  /** 0~1，仅 jpeg / webp 生效 */
  quality: number;
  /** 只导出该区域（选区裁剪导出），缺省导出整张画布 */
  clip?: Rect | null;
}

const MIME: Record<ExportFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export function exportMime(format: ExportFormat): string {
  return MIME[format];
}

/** 合成文档：可选裁剪区域与缩放（缩略图用 0.x 缩放） */
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

/** 直接触发浏览器下载（文件名由调用方拼好） */
export function downloadCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  options: ExportOptions,
): void {
  downloadDataUrl(canvasToDataUrl(canvas, options), filename);
}

/** 图层缩略图：单边最长 48px，按内容比例自适应 */
export function layerThumbnail(doc: PhotoDoc, clip: Rect, max = 48): string {
  const scale = Math.min(1, max / Math.max(clip.width, clip.height));
  const canvas = compositeDoc(doc, clip, scale);
  return canvas.toDataURL('image/png');
}
