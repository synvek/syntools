import { describe, expect, it } from 'vitest';
import { addWatermark, buildTileCenters, parseHexColor } from './core';

describe('parseHexColor', () => {
  it('解析 6 位与 3 位十六进制', () => {
    expect(parseHexColor('#ff0000')).toEqual({ r: 1, g: 0, b: 0 });
    expect(parseHexColor('00ff00')).toEqual({ r: 0, g: 1, b: 0 });
    expect(parseHexColor('#0a0')).toEqual({ r: 0, g: 0.6666666666666666, b: 0 });
  });
  it('拒绝非法颜色', () => {
    expect(parseHexColor('#xyz')).toBeNull();
    expect(parseHexColor('')).toBeNull();
  });
});

describe('buildTileCenters', () => {
  it('在页面内按间距生成网格（不越界）', () => {
    const centers = buildTileCenters(100, 100, 30);
    expect(centers.length).toBeGreaterThan(0);
    for (const c of centers) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThan(100);
    }
  });
  it('间距无效时回退为 1 而不死循环', () => {
    expect(buildTileCenters(10, 10, 0).length).toBe(100);
  });
});

describe('addWatermark', () => {
  it('非 PDF 直接报错', async () => {
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    expect(
      (
        await addWatermark(file, '', {
          text: 'x',
          fontSize: 12,
          opacity: 0.5,
          rotation: 0,
          color: '#000',
          mode: 'all',
          tiled: false,
          spacing: 50,
        })
      ).ok,
    ).toBe(false);
  });
  it('空文本报错', async () => {
    const file = new File(['%PDF-1.4'], 'a.pdf', { type: 'application/pdf' });
    const r = await addWatermark(file, '', {
      text: '   ',
      fontSize: 12,
      opacity: 0.5,
      rotation: 0,
      color: '#000',
      mode: 'all',
      tiled: false,
      spacing: 50,
    });
    expect(r).toEqual({ ok: false, error: 'EMPTY_TEXT' });
  });
  it('非法颜色报错', async () => {
    const file = new File(['%PDF-1.4'], 'a.pdf', { type: 'application/pdf' });
    const r = await addWatermark(file, '', {
      text: 'x',
      fontSize: 12,
      opacity: 0.5,
      rotation: 0,
      color: 'red',
      mode: 'all',
      tiled: false,
      spacing: 50,
    });
    expect(r).toEqual({ ok: false, error: 'INVALID_COLOR' });
  });
});
