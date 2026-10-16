import { downloadBytes, downloadDataUrl } from '@/core/pdf/download';
import { createCanvasElement } from '../model/assets';
import { maskToSelection } from './brush';
import { encodeGif } from './gif';
import { paintDoc } from './paint';
import { encodePdf } from './pdf';
import { encodeTiff, hasTransparency } from './tiff';
import type { PhotoDoc, Rect, Selection } from '../model/types';

/** 导出：把文档合成到离屏画布再编码，不改动用户视口与缩放。 */

export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'tiff' | 'gif' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  /** 0~1，仅 jpeg / webp 生效 */
  quality: number;
  /** 只导出该区域（选区裁剪导出），缺省导出整张画布 */
  clip?: Rect | null;
  /** 仅 pdf 生效：页面尺寸的换算基准（缺省 72 dpi = 像素与点 1:1） */
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
 * 是否由浏览器原生编码。
 *
 * PNG / JPEG / WebP 直接交给 `canvas.toBlob`（走浏览器内建编码器，质量与性能都最好），
 * TIFF / GIF / PDF 则没有原生编码器，需要我们自己写字节（见 `tiff.ts` / `gif.ts` / `pdf.ts`）。
 */
export function isNativeExportFormat(format: ExportFormat): boolean {
  return format === 'png' || format === 'jpeg' || format === 'webp';
}

/** 导出扩展名（文件名拼装用）：jpeg → jpg，其余与格式名一致 */
export function exportExtension(format: ExportFormat): string {
  return format === 'jpeg' ? 'jpg' : format;
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

/**
 * 导出字节：原生格式走 canvas 编码，TIFF / GIF / PDF 走自研编码器。
 *
 * 统一返回 `Uint8Array`，调用方不必再关心「这个格式能不能用 toBlob」。
 */
export async function encodeExport(
  canvas: HTMLCanvasElement,
  options: ExportOptions,
): Promise<Uint8Array> {
  if (isNativeExportFormat(options.format)) {
    const blob = await canvasToBlob(canvas, options);
    if (blob) return new Uint8Array(await blob.arrayBuffer());
    // 极端情况（内存不足等）：退回 data URL 解析，至少不把导出整个打断
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
 * 导出并触发下载。
 *
 * 原生格式仍走 data URL（少一次 Blob 复制），自研编码器走 Blob 下载 ——
 * 一条路径处理六种格式，避免调用方各写一遍分支。
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

/** 读画布像素；拿不到上下文时返回 null（调用方按「导出失败」处理） */
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

/** base64 → 字节（仅在 `toBlob` 失败时的兜底路径上用） */
function decodeBase64(input: string): Uint8Array {
  const binary = atob(input);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * 把选区内容烘焙成一张画布（按选区形状遮罩，反选的洞也会挖空）。
 * 供「通过拷贝新建图层」与「导出选区」共用。
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

/** 图层缩略图：单边最长 48px，按内容比例自适应 */
export function layerThumbnail(doc: PhotoDoc, clip: Rect, max = 48): string {
  const scale = Math.min(1, max / Math.max(clip.width, clip.height));
  const canvas = compositeDoc(doc, clip, scale);
  return canvas.toDataURL('image/png');
}
