import { describe, expect, it } from 'vitest';
import { clampFrameOptions, computeFrameLayout, hexToRgba } from './core';

describe('image-frame', () => {
  it('布局含边框与阴影 padding', () => {
    const r = computeFrameLayout(100, 50, {
      borderWidth: 10,
      borderColor: '#fff',
      radius: 8,
      shadowBlur: 20,
      shadowOffsetX: 0,
      shadowOffsetY: 10,
      shadowColor: '#000',
      shadowOpacity: 0.5,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.imageWidth).toBe(100);
    expect(r.value.contentWidth).toBe(120);
    expect(r.value.canvasWidth).toBeGreaterThan(r.value.contentWidth);
  });

  it('clamp / rgba', () => {
    expect(clampFrameOptions({ borderWidth: 999 }).borderWidth).toBe(80);
    expect(hexToRgba('#abc', 0.5)).toBe('rgba(170,187,204,0.5)');
  });
});
