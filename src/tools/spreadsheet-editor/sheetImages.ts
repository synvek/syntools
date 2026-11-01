import type { SheetShapeConfig } from './shapes';

/**
 * Floating pictures on a sheet (SHEET-02，形状层之后补图片).
 *
 * 与形状共用一套坐标系：**单元格锚点**（`from`）是唯一真值，像素只用于渲染。
 * 图片与形状的区别只在"画什么"：图片把 `src`（dataURL）写成 `xl/media/imageN.<ext>` +
 * drawing 里的 `xdr:pic`，形状写 `xdr:sp`。
 *
 * 为什么存 dataURL 而不是文件路径：快照要能单独还原（草稿、历史版本、导出），
 * 路径一旦离开原文件就失效；导出时把 dataURL 拆成 media part 即可，两边同源不会漂移。
 */

export interface SheetImageConfig {
  id: string;
  sheetId?: string;
  /** 左上角锚点：单元格 + 单元格内像素偏移 */
  from: SheetShapeConfig['from'];
  width: number;
  height: number;
  /** dataURL（png / jpeg / gif / webp） */
  src: string;
  /** 原始文件名，导出成 `cNvPr@name/descr`，也用于界面提示 */
  name: string;
  /** 叠放顺序，小的在下 */
  z: number;
}

export interface ImageBinary {
  mime: string;
  /** 不带点：png / jpeg / gif / webp */
  extension: string;
  base64: string;
}

/** 允许插入的类型：都是 Excel 与浏览器都认的位图，矢量（svg/emf）不做 */
const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/** 单张图片上限：再大就不该塞进 localStorage 快照里 */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** file input 的 accept */
export const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp';

/** 插入时的最大显示尺寸（等比缩放，小图不放大） */
export const MAX_INSERT_SIZE = 320;
export const MIN_IMAGE_SIZE = 24;

export function mimeForExtension(extension: string): string | null {
  return MIME_BY_EXTENSION[extension.toLowerCase()] ?? null;
}

export function extensionForMime(mime: string): string | null {
  return EXTENSION_BY_MIME[mime.toLowerCase()] ?? null;
}

/** `data:image/png;base64,AAA` → 三段；不是位图 dataURL 时返回 null */
export function parseImageDataUrl(src: string): ImageBinary | null {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(src.trim());
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const extension = EXTENSION_BY_MIME[mime];
  if (!extension) return null;
  const base64 = match[2].replace(/\s+/g, '');
  return base64 ? { mime, extension, base64 } : null;
}

export function imageDataUrl(mime: string, base64: string): string {
  return `data:${mime};base64,${base64}`;
}

/** dataURL 的字节数（估算，用于上限判断；base64 每 4 字符 3 字节） */
export function imageBytes(src: string): number {
  const binary = parseImageDataUrl(src);
  if (!binary) return 0;
  const padding = binary.base64.endsWith('==') ? 2 : binary.base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((binary.base64.length * 3) / 4) - padding);
}

/** 等比缩放到 `max` 以内（小图不放大），返回整数尺寸 */
export function fitImageSize(
  naturalWidth: number,
  naturalHeight: number,
  max = MAX_INSERT_SIZE,
): { width: number; height: number } {
  const width = Number.isFinite(naturalWidth) && naturalWidth > 0 ? naturalWidth : max;
  const height = Number.isFinite(naturalHeight) && naturalHeight > 0 ? naturalHeight : max;
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(MIN_IMAGE_SIZE, Math.round(width * scale)),
    height: Math.max(MIN_IMAGE_SIZE, Math.round(height * scale)),
  };
}

let imageSeq = 0;

/** 新建图片；`id` 只在会话内唯一（和形状一致） */
export function createSheetImage(options: {
  src: string;
  name: string;
  from: SheetImageConfig['from'];
  sheetId?: string;
  width?: number;
  height?: number;
  z?: number;
}): SheetImageConfig {
  imageSeq += 1;
  return {
    id: `image-${Date.now().toString(36)}-${imageSeq}`,
    ...(options.sheetId ? { sheetId: options.sheetId } : {}),
    from: options.from,
    width: Math.max(MIN_IMAGE_SIZE, Math.round(options.width ?? MAX_INSERT_SIZE)),
    height: Math.max(MIN_IMAGE_SIZE, Math.round(options.height ?? MAX_INSERT_SIZE)),
    src: options.src,
    name: options.name || 'image',
    z: options.z ?? 0,
  };
}
