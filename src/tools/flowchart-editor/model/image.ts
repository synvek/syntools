/**
 * 图片节点素材处理：读取本地文件为 dataURL，并等比压缩到安全尺寸。
 *
 * 全程在浏览器内完成（FileReader + canvas），图片不会离开设备；
 * 压缩的目的主要是控制草稿体积与导出/渲染开销。
 */

import { IMAGE_MAX_EDGE } from './types';

export interface LoadedImage {
  /** dataURL（已按需压缩） */
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
 * 读取图片文件；超过最大边长时用 canvas 等比压缩。
 * 返回 null 表示文件无法解码（调用方提示导入失败）。
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
  // PNG/SVG 保持无损与透明；其它格式（照片）用 JPEG 控制体积
  const keepAlpha = file.type === 'image/png' || file.type === 'image/svg+xml';
  const src = keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
  return { src, width: targetW, height: targetH };
}

/** 在给定最大宽高内等比缩放（用于把图片放进节点默认尺寸） */
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
