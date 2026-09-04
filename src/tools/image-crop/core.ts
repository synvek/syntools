import type { ToolResult } from '@/core/types';

/**
 * 图片裁剪：矩形约束与比例预设。
 */

export type CropError = 'INVALID' | 'EMPTY';

export type CropAspect = 'free' | '1:1' | '4:3' | '3:4' | '16:9' | '9:16';

export const CROP_ASPECTS: CropAspect[] = ['free', '1:1', '4:3', '3:4', '16:9', '9:16'];

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function isImageFile(type: string): boolean {
  return type.startsWith('image/');
}

export function aspectRatio(aspect: CropAspect): number | null {
  switch (aspect) {
    case '1:1':
      return 1;
    case '4:3':
      return 4 / 3;
    case '3:4':
      return 3 / 4;
    case '16:9':
      return 16 / 9;
    case '9:16':
      return 9 / 16;
    default:
      return null;
  }
}

/** 将裁剪框限制在图片内，宽高至少 1px */
export function clampCrop(rect: CropRect, imgW: number, imgH: number): CropRect {
  let { x, y, width, height } = rect;
  width = Math.max(1, Math.min(Math.round(width), imgW));
  height = Math.max(1, Math.min(Math.round(height), imgH));
  x = Math.max(0, Math.min(Math.round(x), imgW - width));
  y = Math.max(0, Math.min(Math.round(y), imgH - height));
  return { x, y, width, height };
}

export function validateCrop(
  rect: CropRect,
  imgW: number,
  imgH: number,
): ToolResult<CropRect> {
  if (!Number.isFinite(imgW) || !Number.isFinite(imgH) || imgW < 1 || imgH < 1) {
    return { ok: false, error: 'EMPTY' };
  }
  const c = clampCrop(rect, imgW, imgH);
  if (c.width < 1 || c.height < 1) return { ok: false, error: 'INVALID' };
  return { ok: true, value: c };
}

/** 按比例调整现有框（尽量居中保持面积） */
export function fitAspect(rect: CropRect, aspect: CropAspect, imgW: number, imgH: number): CropRect {
  const ratio = aspectRatio(aspect);
  if (ratio == null) return clampCrop(rect, imgW, imgH);

  let width = rect.width;
  let height = Math.round(width / ratio);
  if (height > imgH) {
    height = imgH;
    width = Math.round(height * ratio);
  }
  if (width > imgW) {
    width = imgW;
    height = Math.round(width / ratio);
  }
  width = Math.max(1, width);
  height = Math.max(1, height);
  const x = Math.round(rect.x + (rect.width - width) / 2);
  const y = Math.round(rect.y + (rect.height - height) / 2);
  return clampCrop({ x, y, width, height }, imgW, imgH);
}

export function defaultCrop(imgW: number, imgH: number): CropRect {
  const side = Math.min(imgW, imgH);
  return clampCrop(
    {
      x: Math.round((imgW - side) / 2),
      y: Math.round((imgH - side) / 2),
      width: side,
      height: side,
    },
    imgW,
    imgH,
  );
}
