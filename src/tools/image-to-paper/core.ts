import type { ToolResult } from '@/core/types';

/**
 * 图片转纸张：纸张尺寸（mm）与 fit/cover 布局计算。
 */

export type PaperSize = 'A3' | 'A4' | 'A5' | 'Letter';
export type Orientation = 'portrait' | 'landscape';
export type FitMode = 'contain' | 'cover';
export type ImageToPaperError = 'INVALID_MARGIN' | 'INVALID_IMAGE';

/** 纸张尺寸（毫米，portrait 宽×高） */
export const PAPER_SIZES_MM: Record<PaperSize, { width: number; height: number }> = {
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  Letter: { width: 215.9, height: 279.4 },
};

export const PAPER_SIZE_IDS: PaperSize[] = ['A3', 'A4', 'A5', 'Letter'];

export const MIN_MARGIN_MM = 0;
export const MAX_MARGIN_MM = 50;

/** 预览用：1 英寸 = 25.4mm，按 96 DPI 换算像素 */
export const PREVIEW_DPI = 96;

export interface LayoutOptions {
  paper: PaperSize;
  orientation: Orientation;
  marginMm: number;
  fit: FitMode;
  imageWidth: number;
  imageHeight: number;
}

export interface PaperLayout {
  /** 纸张宽高（mm） */
  paperWidthMm: number;
  paperHeightMm: number;
  /** 内容区（扣除边距） */
  contentXMm: number;
  contentYMm: number;
  contentWidthMm: number;
  contentHeightMm: number;
  /** 图片绘制位置与尺寸（mm） */
  drawXMm: number;
  drawYMm: number;
  drawWidthMm: number;
  drawHeightMm: number;
  scale: number;
}

export function paperDimensionsMm(
  paper: PaperSize,
  orientation: Orientation,
): { width: number; height: number } {
  const base = PAPER_SIZES_MM[paper];
  if (orientation === 'landscape') {
    return { width: base.height, height: base.width };
  }
  return { width: base.width, height: base.height };
}

export function mmToPx(mm: number, dpi = PREVIEW_DPI): number {
  return (mm / 25.4) * dpi;
}

/** 计算图片在纸张上的布局（contain / cover） */
export function computeLayout(options: LayoutOptions): ToolResult<PaperLayout> {
  const { paper, orientation, marginMm, fit, imageWidth, imageHeight } = options;
  if (
    !Number.isFinite(marginMm) ||
    marginMm < MIN_MARGIN_MM ||
    marginMm > MAX_MARGIN_MM
  ) {
    return { ok: false, error: 'INVALID_MARGIN' };
  }
  if (
    !Number.isFinite(imageWidth) ||
    !Number.isFinite(imageHeight) ||
    imageWidth < 1 ||
    imageHeight < 1
  ) {
    return { ok: false, error: 'INVALID_IMAGE' };
  }

  const { width: paperWidthMm, height: paperHeightMm } = paperDimensionsMm(paper, orientation);
  const maxMargin = Math.min(paperWidthMm, paperHeightMm) / 2 - 0.1;
  const margin = Math.min(marginMm, Math.max(0, maxMargin));
  const contentWidthMm = paperWidthMm - margin * 2;
  const contentHeightMm = paperHeightMm - margin * 2;
  if (contentWidthMm <= 0 || contentHeightMm <= 0) {
    return { ok: false, error: 'INVALID_MARGIN' };
  }

  // 将像素视为与 mm 同比例的抽象单位，用宽高比计算缩放
  const scaleX = contentWidthMm / imageWidth;
  const scaleY = contentHeightMm / imageHeight;
  const scale = fit === 'cover' ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
  const drawWidthMm = imageWidth * scale;
  const drawHeightMm = imageHeight * scale;
  const drawXMm = margin + (contentWidthMm - drawWidthMm) / 2;
  const drawYMm = margin + (contentHeightMm - drawHeightMm) / 2;

  return {
    ok: true,
    value: {
      paperWidthMm,
      paperHeightMm,
      contentXMm: margin,
      contentYMm: margin,
      contentWidthMm,
      contentHeightMm,
      drawXMm,
      drawYMm,
      drawWidthMm,
      drawHeightMm,
      scale,
    },
  };
}

export function isImageFile(type: string): boolean {
  return type.startsWith('image/');
}
