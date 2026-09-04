import type { ToolResult } from '@/core/types';

/**
 * 图片边框 / 圆角 / 阴影：参数校验与画布尺寸（绘制在 UI）。
 */

export type FrameError = 'NOT_IMAGE' | 'INVALID';

export interface FrameOptions {
  borderWidth: number;
  borderColor: string;
  radius: number;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowColor: string;
  shadowOpacity: number;
}

export const DEFAULT_FRAME: FrameOptions = {
  borderWidth: 8,
  borderColor: '#ffffff',
  radius: 16,
  shadowBlur: 24,
  shadowOffsetX: 0,
  shadowOffsetY: 12,
  shadowColor: '#000000',
  shadowOpacity: 0.35,
};

export function isImageFile(type: string): boolean {
  return type.startsWith('image/');
}

export function clampFrameOptions(raw: Partial<FrameOptions>): FrameOptions {
  const n = (v: unknown, min: number, max: number, fallback: number) => {
    const x = Number(v);
    if (!Number.isFinite(x)) return fallback;
    return Math.min(max, Math.max(min, x));
  };
  return {
    borderWidth: n(raw.borderWidth, 0, 80, DEFAULT_FRAME.borderWidth),
    borderColor: typeof raw.borderColor === 'string' ? raw.borderColor : DEFAULT_FRAME.borderColor,
    radius: n(raw.radius, 0, 400, DEFAULT_FRAME.radius),
    shadowBlur: n(raw.shadowBlur, 0, 120, DEFAULT_FRAME.shadowBlur),
    shadowOffsetX: n(raw.shadowOffsetX, -80, 80, DEFAULT_FRAME.shadowOffsetX),
    shadowOffsetY: n(raw.shadowOffsetY, -80, 80, DEFAULT_FRAME.shadowOffsetY),
    shadowColor: typeof raw.shadowColor === 'string' ? raw.shadowColor : DEFAULT_FRAME.shadowColor,
    shadowOpacity: n(raw.shadowOpacity, 0, 1, DEFAULT_FRAME.shadowOpacity),
  };
}

export interface FrameLayout {
  canvasWidth: number;
  canvasHeight: number;
  /** 内容区（含边框）左上角 */
  contentX: number;
  contentY: number;
  contentWidth: number;
  contentHeight: number;
  /** 图片绘制区（边框内侧） */
  imageX: number;
  imageY: number;
  imageWidth: number;
  imageHeight: number;
}

/** 为阴影留出 padding，计算最终画布布局 */
export function computeFrameLayout(
  imgW: number,
  imgH: number,
  options: FrameOptions,
): ToolResult<FrameLayout> {
  if (!Number.isFinite(imgW) || !Number.isFinite(imgH) || imgW < 1 || imgH < 1) {
    return { ok: false, error: 'INVALID' };
  }
  const o = clampFrameOptions(options);
  const padL = Math.max(0, o.shadowBlur - Math.min(0, o.shadowOffsetX));
  const padR = Math.max(0, o.shadowBlur + Math.max(0, o.shadowOffsetX));
  const padT = Math.max(0, o.shadowBlur - Math.min(0, o.shadowOffsetY));
  const padB = Math.max(0, o.shadowBlur + Math.max(0, o.shadowOffsetY));
  const contentWidth = imgW + o.borderWidth * 2;
  const contentHeight = imgH + o.borderWidth * 2;
  return {
    ok: true,
    value: {
      canvasWidth: Math.ceil(contentWidth + padL + padR),
      canvasHeight: Math.ceil(contentHeight + padT + padB),
      contentX: padL,
      contentY: padT,
      contentWidth,
      contentHeight,
      imageX: padL + o.borderWidth,
      imageY: padT + o.borderWidth,
      imageWidth: imgW,
      imageHeight: imgH,
    },
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return `rgba(0,0,0,${alpha})`;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.min(1, Math.max(0, alpha))})`;
}
