import { describe, expect, it } from 'vitest';
import { clampOpacity, resolveAnchor, validateWatermarkText } from './core';

describe('image-watermark', () => {
  it('锚点', () => {
    expect(resolveAnchor(100, 100, 20, 10, 'top-left')).toEqual({ x: 16, y: 26 });
    expect(resolveAnchor(100, 100, 20, 10, 'bottom-right').x).toBe(64);
  });

  it('透明度钳制', () => {
    expect(clampOpacity(2)).toBe(1);
    expect(clampOpacity(-1)).toBe(0.05);
  });

  it('空文案', () => {
    expect(validateWatermarkText('  ')).toEqual({ ok: false, error: 'ENCODE' });
  });
});
