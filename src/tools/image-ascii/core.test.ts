import { describe, expect, it } from 'vitest';
import { imageDataToAscii } from './core';

/** 生成单色 RGBA 像素 */
function solid(width: number, height: number, value: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = value;
    data[i * 4 + 1] = value;
    data[i * 4 + 2] = value;
    data[i * 4 + 3] = 255;
  }
  return data;
}

describe('image-ascii', () => {
  it('全白映射为空格（charset 首字符）', () => {
    const r = imageDataToAscii(solid(10, 10, 255), 10, 10, {
      cols: 5,
      charset: ' .#',
      invert: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.split('\n')[0]).toBe('     ');
  });

  it('全黑映射为末字符', () => {
    const r = imageDataToAscii(solid(10, 10, 0), 10, 10, {
      cols: 5,
      charset: ' .#',
      invert: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.split('\n')[0]).toBe('#####');
  });

  it('invert 反转明暗', () => {
    const r = imageDataToAscii(solid(10, 10, 255), 10, 10, {
      cols: 4,
      charset: ' .#',
      invert: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.split('\n')[0]).toBe('####');
  });

  it('行数按宽高比与 cols 计算', () => {
    const r = imageDataToAscii(solid(100, 50, 128), 100, 50, {
      cols: 20,
      charset: ' .#',
      invert: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.split('\n').length).toBeGreaterThan(1);
  });

  it('非法尺寸报错', () => {
    expect(
      imageDataToAscii(new Uint8ClampedArray(0), 0, 0, { cols: 10, charset: ' .#', invert: false }),
    ).toEqual({
      ok: false,
      error: 'EMPTY',
    });
  });
});
