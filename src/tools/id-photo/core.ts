import type { ToolResult } from '@/core/types';

export interface PhotoSizePreset {
  id: string;
  mmW: number;
  mmH: number;
}

export const ID_PHOTO_SIZES: PhotoSizePreset[] = [
  { id: 'one-inch', mmW: 25, mmH: 35 },
  { id: 'small-one', mmW: 22, mmH: 32 },
  { id: 'large-one', mmW: 33, mmH: 48 },
  { id: 'two-inch', mmW: 35, mmH: 49 },
  { id: 'small-two', mmW: 35, mmH: 45 },
  { id: 'passport', mmW: 33, mmH: 48 },
  { id: 'visa', mmW: 35, mmH: 45 },
  { id: 'driver', mmW: 22, mmH: 32 },
];

export const DEFAULT_DPI = 300;

/** 毫米 → 像素（按给定 DPI）。 */
export function mmToPx(mm: number, dpi = DEFAULT_DPI): number {
  return Math.round((mm / 25.4) * dpi);
}

/** 计算目标尺寸像素。 */
export function targetPixels(
  presetId: string,
  dpi = DEFAULT_DPI,
): ToolResult<{ width: number; height: number }> {
  const preset = ID_PHOTO_SIZES.find((p) => p.id === presetId);
  if (!preset) return { ok: false, error: 'UNKNOWN_SIZE' };
  if (!Number.isFinite(dpi) || dpi < 30 || dpi > 1200) return { ok: false, error: 'INVALID_DPI' };
  return { ok: true, value: { width: mmToPx(preset.mmW, dpi), height: mmToPx(preset.mmH, dpi) } };
}

export interface SourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** 计算「覆盖式居中裁剪」的源矩形，用于在目标比例下尽量填满。 */
export function coverCrop(
  imgW: number,
  imgH: number,
  targetW: number,
  targetH: number,
): SourceRect {
  const targetRatio = targetW / targetH;
  const imgRatio = imgW / imgH;
  if (imgRatio > targetRatio) {
    const sw = Math.round(imgH * targetRatio);
    return { sx: Math.round((imgW - sw) / 2), sy: 0, sw, sh: imgH };
  }
  const sh = Math.round(imgW / targetRatio);
  return { sx: 0, sy: Math.round((imgH - sh) / 2), sw: imgW, sh };
}
