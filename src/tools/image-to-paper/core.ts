import type { ToolResult } from '@/core/types';

/**
 * Image to paper: paper sizes (mm) and fit / cover layout math.
 */

export type PaperSize = 'A3' | 'A4' | 'A5' | 'Letter';
export type Orientation = 'portrait' | 'landscape';
export type FitMode = 'contain' | 'cover';
export type ImageToPaperError = 'INVALID_MARGIN' | 'INVALID_IMAGE';

/** Paper size (millimeters, portrait width × height) */
export const PAPER_SIZES_MM: Record<PaperSize, { width: number; height: number }> = {
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  Letter: { width: 215.9, height: 279.4 },
};

export const PAPER_SIZE_IDS: PaperSize[] = ['A3', 'A4', 'A5', 'Letter'];

export const MIN_MARGIN_MM = 0;
export const MAX_MARGIN_MM = 50;

/** For previews: 1 inch = 25.4mm, converted to pixels at 96 DPI */
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
  /** Paper width and height (mm) */
  paperWidthMm: number;
  paperHeightMm: number;
  /** Content area (after margins) */
  contentXMm: number;
  contentYMm: number;
  contentWidthMm: number;
  contentHeightMm: number;
  /** Image position and size (mm) */
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

/** Lay the image out on the paper (contain / cover) */
export function computeLayout(options: LayoutOptions): ToolResult<PaperLayout> {
  const { paper, orientation, marginMm, fit, imageWidth, imageHeight } = options;
  if (!Number.isFinite(marginMm) || marginMm < MIN_MARGIN_MM || marginMm > MAX_MARGIN_MM) {
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

  // Treat pixels as abstract units proportional to mm and derive the scale from the aspect ratio
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
