import { describe, expect, it } from 'vitest';
import { samplePixel } from './core';

describe('image-color-picker', () => {
  it('取样像素', () => {
    // 1x1 红像素
    const data = new Uint8ClampedArray([255, 0, 0, 255]);
    const r = samplePixel(data, 1, 1, 0, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.hex).toBe('#ff0000');
    expect(r.value.rgb).toBe('rgb(255, 0, 0)');
  });

  it('越界', () => {
    const data = new Uint8ClampedArray([0, 0, 0, 255]);
    expect(samplePixel(data, 1, 1, 2, 0)).toEqual({ ok: false, error: 'OUT_OF_BOUNDS' });
  });
});
