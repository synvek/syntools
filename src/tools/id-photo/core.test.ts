import { describe, expect, it } from 'vitest';
import { coverCrop, ID_PHOTO_SIZES, mmToPx, targetPixels } from './core';

describe('id-photo', () => {
  it('毫米转像素（300dpi）', () => {
    expect(mmToPx(25)).toBe(295);
    expect(mmToPx(35)).toBe(413);
  });

  it('1 寸目标尺寸', () => {
    expect(targetPixels('one-inch')).toEqual({ ok: true, value: { width: 295, height: 413 } });
  });

  it('未知尺寸报错', () => {
    expect(targetPixels('nope')).toEqual({ ok: false, error: 'UNKNOWN_SIZE' });
  });

  it('非法 DPI 报错', () => {
    expect(targetPixels('one-inch', 0)).toEqual({ ok: false, error: 'INVALID_DPI' });
  });

  it('横图按覆盖式居中裁剪', () => {
    const r = coverCrop(1000, 500, 295, 413);
    // 目标更窄更高，则裁剪宽度
    expect(r.sw).toBe(Math.round(500 * (295 / 413)));
    expect(r.sx).toBe(Math.round((1000 - r.sw) / 2));
    expect(r.sh).toBe(500);
  });

  it('竖图裁剪高度', () => {
    const r = coverCrop(500, 1000, 295, 413);
    expect(r.sw).toBe(500);
    expect(r.sh).toBe(Math.round(500 / (295 / 413)));
  });

  it('预设均有正尺寸', () => {
    for (const p of ID_PHOTO_SIZES) {
      expect(p.mmW).toBeGreaterThan(0);
      expect(p.mmH).toBeGreaterThan(0);
    }
  });
});
