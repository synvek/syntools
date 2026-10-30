import { describe, expect, it } from 'vitest';
import {
  applyColorTransform,
  emuToPx,
  hundredthsPtToPt,
  normalizeHex,
  ptToHundredthsPt,
  ptToPx,
  pxToEmu,
  pxToPt,
  withAlpha,
} from './geometry';
import { resolvePresetGeometry, starPoints } from './shapeDefs';

/** Unit conversion, DrawingML color correction and prstGeom mapping (moved here with P2-6) */

describe('EMU / 磅值换算', () => {
  it('EMU 与 px 互转无损', () => {
    expect(pxToEmu(1280)).toBe(12192000);
    expect(pxToEmu(720)).toBe(6858000);
    expect(emuToPx(12192000)).toBe(1280);
    expect(emuToPx(pxToEmu(333))).toBe(333);
  });

  it('字号 1/100 pt 与磅值互转', () => {
    expect(hundredthsPtToPt(1800)).toBe(18);
    expect(ptToHundredthsPt(11.5)).toBe(1150);
  });

  it('pt 与 px 互转（96dpi）', () => {
    expect(ptToPx(18)).toBeCloseTo(24, 5);
    expect(pxToPt(24)).toBeCloseTo(18, 5);
  });
});

describe('颜色', () => {
  it('归一化十六进制', () => {
    expect(normalizeHex('#ABCDEF')).toBe('#abcdef');
    expect(normalizeHex('fff')).toBe('#ffffff');
    expect(normalizeHex('nope')).toBeNull();
    expect(normalizeHex(undefined)).toBeNull();
  });

  it('tint 向白插值，shade 向黑插值', () => {
    expect(applyColorTransform('#000000', { tint: 100000 })).toBe('#ffffff');
    expect(applyColorTransform('#ffffff', { shade: 50000 })).toBe('#808080');
    expect(applyColorTransform('#ff0000', {})).toBe('#ff0000');
  });

  it('lumMod / lumOff 叠加', () => {
    expect(applyColorTransform('#ffffff', { lumMod: 50000 })).toBe('#808080');
    expect(applyColorTransform('#000000', { lumOff: 50000 })).toBe('#808080');
    expect(applyColorTransform('#000000', { lumMod: 80000, lumOff: 20000 })).toBe('#333333');
  });

  it('withAlpha 输出 rgba', () => {
    expect(withAlpha('#ff8800', 0.5)).toBe('rgba(255, 136, 0, 0.500)');
    expect(withAlpha('#ff8800', 1)).toBe('#ff8800');
  });
});

describe('prstGeom 几何映射', () => {
  it('已知形状返回对应 kind', () => {
    expect(resolvePresetGeometry('ellipse').kind).toBe('ellipse');
    expect(resolvePresetGeometry('roundRect').kind).toBe('rect');
    expect(resolvePresetGeometry('rightArrow').kind).toBe('polygon');
    expect(resolvePresetGeometry('star5').kind).toBe('star');
  });

  it('未知形状降级为矩形并保留 prst', () => {
    const geom = resolvePresetGeometry('weirdShape');
    expect(geom.kind).toBe('rect');
    expect(geom.prst).toBe('weirdShape');
  });

  it('星形顶点数', () => {
    expect(starPoints('star5')).toBe(5);
    expect(starPoints('star12')).toBe(12);
    expect(starPoints('other')).toBe(5);
  });
});
