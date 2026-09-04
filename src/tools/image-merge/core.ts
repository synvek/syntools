import type { ToolResult } from '@/core/types';

/**
 * 图片合并：布局尺寸计算（绘制在 UI canvas）。
 */

export type MergeDirection = 'horizontal' | 'vertical' | 'grid';
export type MergeError = 'EMPTY' | 'TOO_MANY';

export const MAX_IMAGES = 9;

export interface ImageSize {
  width: number;
  height: number;
}

export interface MergeLayout {
  canvasWidth: number;
  canvasHeight: number;
  /** 每个槽位的绘制目标矩形 */
  slots: { x: number; y: number; width: number; height: number }[];
}

export function isImageFile(type: string): boolean {
  return type.startsWith('image/');
}

/** 等比缩放到放入 box，居中时用返回尺寸 */
export function fitContain(
  srcW: number,
  srcH: number,
  boxW: number,
  boxH: number,
): ImageSize {
  const scale = Math.min(boxW / srcW, boxH / srcH);
  return {
    width: Math.max(1, Math.round(srcW * scale)),
    height: Math.max(1, Math.round(srcH * scale)),
  };
}

export function computeMergeLayout(
  sizes: ImageSize[],
  direction: MergeDirection,
  gap = 0,
): ToolResult<MergeLayout> {
  if (sizes.length === 0) return { ok: false, error: 'EMPTY' };
  if (sizes.length > MAX_IMAGES) return { ok: false, error: 'TOO_MANY' };

  if (direction === 'horizontal') {
    const height = Math.max(...sizes.map((s) => s.height));
    let x = 0;
    const slots = sizes.map((s) => {
      const slot = { x, y: Math.round((height - s.height) / 2), width: s.width, height: s.height };
      x += s.width + gap;
      return slot;
    });
    return {
      ok: true,
      value: {
        canvasWidth: x - gap,
        canvasHeight: height,
        slots,
      },
    };
  }

  if (direction === 'vertical') {
    const width = Math.max(...sizes.map((s) => s.width));
    let y = 0;
    const slots = sizes.map((s) => {
      const slot = { x: Math.round((width - s.width) / 2), y, width: s.width, height: s.height };
      y += s.height + gap;
      return slot;
    });
    return {
      ok: true,
      value: {
        canvasWidth: width,
        canvasHeight: y - gap,
        slots,
      },
    };
  }

  // grid：尽量接近正方形列数
  const cols = Math.ceil(Math.sqrt(sizes.length));
  const rows = Math.ceil(sizes.length / cols);
  const cellW = Math.max(...sizes.map((s) => s.width));
  const cellH = Math.max(...sizes.map((s) => s.height));
  const slots = sizes.map((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const fitted = fitContain(s.width, s.height, cellW, cellH);
    return {
      x: col * (cellW + gap) + Math.round((cellW - fitted.width) / 2),
      y: row * (cellH + gap) + Math.round((cellH - fitted.height) / 2),
      width: fitted.width,
      height: fitted.height,
    };
  });
  return {
    ok: true,
    value: {
      canvasWidth: cols * cellW + (cols - 1) * gap,
      canvasHeight: rows * cellH + (rows - 1) * gap,
      slots,
    },
  };
}
