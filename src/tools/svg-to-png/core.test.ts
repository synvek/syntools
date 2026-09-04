import { describe, expect, it } from 'vitest';
import {
  computeOutputSize,
  extractSvgSize,
  svgToDataUrl,
  validateSvg,
} from './core';

describe('svg-to-png', () => {
  it('解析尺寸', () => {
    expect(
      extractSvgSize('<svg width="100" height="50" xmlns="http://www.w3.org/2000/svg"></svg>'),
    ).toEqual({ width: 100, height: 50 });
    expect(
      extractSvgSize('<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg"></svg>'),
    ).toEqual({ width: 200, height: 100 });
  });

  it('校验', () => {
    expect(validateSvg('')).toEqual({ ok: false, error: 'EMPTY' });
    expect(validateSvg('<div/>')).toEqual({ ok: false, error: 'INVALID_SVG' });
    const ok = validateSvg(
      '<svg width="10" height="10" xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>',
    );
    expect(ok.ok).toBe(true);
  });

  it('输出尺寸与 data URL', () => {
    expect(computeOutputSize(100, 50, 2)).toEqual({
      ok: true,
      value: { width: 200, height: 100 },
    });
    expect(computeOutputSize(100, 50, 99)).toEqual({ ok: false, error: 'INVALID_SIZE' });
    expect(svgToDataUrl('<svg/>')).toContain('data:image/svg+xml');
  });
});
