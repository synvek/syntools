import type { ToolResult } from '@/core/types';

/**
 * 图片水印：在 canvas 上绘制文字/图片水印的参数与布局计算。
 */

export type WatermarkPosition =
  | 'top-left'
  | 'top-right'
  | 'center'
  | 'bottom-left'
  | 'bottom-right'
  | 'tile';

export type WatermarkError = 'NOT_IMAGE' | 'ENCODE';

export interface TextWatermarkOptions {
  text: string;
  fontSize: number;
  color: string;
  opacity: number; // 0-1
  position: WatermarkPosition;
  rotate: number; // degrees
  gap: number; // tile spacing
}

export const DEFAULT_WATERMARK: TextWatermarkOptions = {
  text: 'Watermark',
  fontSize: 28,
  color: '#ffffff',
  opacity: 0.45,
  position: 'bottom-right',
  rotate: -24,
  gap: 160,
};

export function clampOpacity(n: number): number {
  if (!Number.isFinite(n)) return 0.45;
  return Math.min(1, Math.max(0.05, n));
}

export function isImageFile(type: string): boolean {
  return type.startsWith('image/');
}

/** 计算水印锚点（非 tile） */
export function resolveAnchor(
  width: number,
  height: number,
  markW: number,
  markH: number,
  position: WatermarkPosition,
  margin = 16,
): { x: number; y: number } {
  switch (position) {
    case 'top-left':
      return { x: margin, y: margin + markH };
    case 'top-right':
      return { x: width - margin - markW, y: margin + markH };
    case 'center':
      return { x: (width - markW) / 2, y: (height + markH) / 2 };
    case 'bottom-left':
      return { x: margin, y: height - margin };
    case 'bottom-right':
    default:
      return { x: width - margin - markW, y: height - margin };
  }
}

export function validateWatermarkText(text: string): ToolResult<string> {
  const t = text.trim();
  if (!t) return { ok: false, error: 'ENCODE' };
  return { ok: true, value: t.slice(0, 80) };
}
