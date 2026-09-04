import { describe, expect, it } from 'vitest';
import {
  computeLayout,
  isImageFile,
  mmToPx,
  paperDimensionsMm,
} from './core';

describe('image-to-paper', () => {
  it('portrait / landscape 尺寸互换', () => {
    expect(paperDimensionsMm('A4', 'portrait')).toEqual({ width: 210, height: 297 });
    expect(paperDimensionsMm('A4', 'landscape')).toEqual({ width: 297, height: 210 });
  });

  it('contain 布局居中且不超出内容区', () => {
    const r = computeLayout({
      paper: 'A4',
      orientation: 'portrait',
      marginMm: 10,
      fit: 'contain',
      imageWidth: 200,
      imageHeight: 100,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.contentWidthMm).toBe(190);
    expect(r.value.contentHeightMm).toBe(277);
    expect(r.value.drawWidthMm).toBeLessThanOrEqual(r.value.contentWidthMm + 1e-9);
    expect(r.value.drawHeightMm).toBeLessThanOrEqual(r.value.contentHeightMm + 1e-9);
    expect(r.value.drawWidthMm / r.value.drawHeightMm).toBeCloseTo(2, 5);
  });

  it('cover 布局至少覆盖内容区', () => {
    const r = computeLayout({
      paper: 'A4',
      orientation: 'portrait',
      marginMm: 0,
      fit: 'cover',
      imageWidth: 100,
      imageHeight: 200,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.drawWidthMm).toBeGreaterThanOrEqual(r.value.contentWidthMm - 1e-9);
    expect(r.value.drawHeightMm).toBeGreaterThanOrEqual(r.value.contentHeightMm - 1e-9);
  });

  it('非法边距 / 图片', () => {
    expect(
      computeLayout({
        paper: 'A4',
        orientation: 'portrait',
        marginMm: -1,
        fit: 'contain',
        imageWidth: 100,
        imageHeight: 100,
      }),
    ).toEqual({ ok: false, error: 'INVALID_MARGIN' });
    expect(
      computeLayout({
        paper: 'A4',
        orientation: 'portrait',
        marginMm: 10,
        fit: 'contain',
        imageWidth: 0,
        imageHeight: 100,
      }),
    ).toEqual({ ok: false, error: 'INVALID_IMAGE' });
  });

  it('mmToPx / isImageFile', () => {
    expect(mmToPx(25.4, 96)).toBeCloseTo(96, 5);
    expect(isImageFile('image/png')).toBe(true);
    expect(isImageFile('application/pdf')).toBe(false);
  });
});
