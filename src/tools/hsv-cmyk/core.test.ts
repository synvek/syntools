import { describe, expect, it } from 'vitest';
import {
  cmykToRgb,
  fromHex,
  hexToRgb,
  hsvToRgb,
  rgbToCmyk,
  rgbToHex,
  rgbToHsv,
} from './core';

describe('hsv-cmyk', () => {
  it('hex ↔ rgb', () => {
    expect(hexToRgb('#3b82f6')).toEqual({
      ok: true,
      value: { r: 59, g: 130, b: 246 },
    });
    expect(rgbToHex({ r: 59, g: 130, b: 246 })).toBe('#3b82f6');
    expect(hexToRgb('')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('rgb ↔ hsv 往返近似', () => {
    const rgb = { r: 255, g: 0, b: 0 };
    const hsv = rgbToHsv(rgb);
    expect(hsv.h).toBe(0);
    expect(hsv.s).toBe(100);
    expect(hsv.v).toBe(100);
    expect(hsvToRgb(hsv)).toEqual(rgb);
  });

  it('rgb ↔ cmyk 黑白', () => {
    expect(rgbToCmyk({ r: 0, g: 0, b: 0 })).toEqual({ c: 0, m: 0, y: 0, k: 100 });
    expect(cmykToRgb({ c: 0, m: 0, y: 0, k: 0 })).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('fromHex 完整状态', () => {
    const r = fromHex('#000');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.hex).toBe('#000000');
    expect(r.value.cmyk.k).toBe(100);
  });
});
