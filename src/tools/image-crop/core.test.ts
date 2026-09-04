import { describe, expect, it } from 'vitest';
import { clampCrop, defaultCrop, fitAspect, validateCrop } from './core';

describe('image-crop', () => {
  it('clamp', () => {
    expect(clampCrop({ x: -10, y: 0, width: 50, height: 50 }, 100, 80)).toEqual({
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
  });

  it('默认与比例', () => {
    const d = defaultCrop(200, 100);
    expect(d.width).toBe(100);
    expect(d.height).toBe(100);
    const a = fitAspect(d, '16:9', 200, 100);
    expect(a.width / a.height).toBeCloseTo(16 / 9, 1);
  });

  it('校验', () => {
    expect(validateCrop({ x: 0, y: 0, width: 10, height: 10 }, 100, 100).ok).toBe(true);
    expect(validateCrop({ x: 0, y: 0, width: 10, height: 10 }, 0, 0)).toEqual({
      ok: false,
      error: 'EMPTY',
    });
  });
});
