import { describe, expect, it } from 'vitest';
import {
  emuToPx,
  pxToEmu,
  hundredthsPtToPt,
  ptToHundredthsPt,
  ptToPx,
  pxToPt,
  withAlpha,
  applyColorTransform,
  normalizeHex,
  resolvePresetGeometry,
  starPoints,
  computeSnap,
  normalizeAngle,
  containInto,
  fitScale,
  buildExportFilename,
  type Guide,
} from './core';

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

describe('吸附对齐', () => {
  it('吸附到页面中心线', () => {
    const result = computeSnap(
      { x: 620, y: 100, width: 100, height: 50 },
      [],
      { width: 1280, height: 720 },
      6,
    );
    // 各边/中线距页面中心线均超过容差 → 不吸附
    expect(result.x).toBe(620);
    expect(result.guides).toEqual([]);
  });

  it('在容差内吸附并产生参考线', () => {
    const result = computeSnap(
      { x: 636, y: 100, width: 60, height: 50 },
      [],
      { width: 1280, height: 720 },
      6,
    );
    expect(result.x).toBe(640);
    expect((result.guides as Guide[]).some((g) => g.axis === 'x' && g.position === 640)).toBe(true);
  });

  it('与其它元素的边缘对齐', () => {
    const result = computeSnap(
      { x: 103, y: 300, width: 100, height: 40 },
      [{ x: 100, y: 100, width: 100, height: 40 }],
      { width: 1280, height: 720 },
      6,
    );
    expect(result.x).toBe(100);
  });
});

describe('工具函数', () => {
  it('角度归一化', () => {
    expect(normalizeAngle(370)).toBe(10);
    expect(normalizeAngle(-90)).toBe(270);
  });

  it('containInto 等比缩小不放大超过 1 倍', () => {
    expect(containInto({ width: 400, height: 300 }, { width: 200, height: 200 })).toEqual({
      width: 200,
      height: 150,
    });
    expect(containInto({ width: 100, height: 100 }, { width: 400, height: 400 })).toEqual({
      width: 100,
      height: 100,
    });
  });

  it('fitScale 留出边距并限制上限', () => {
    expect(fitScale({ width: 1280, height: 720 }, { width: 1400, height: 900 })).toBeCloseTo(
      1.044,
      3,
    );
    expect(fitScale({ width: 1280, height: 720 }, { width: 300, height: 300 })).toBeGreaterThan(
      0.1,
    );
  });

  it('导出文件名清洗', () => {
    expect(buildExportFilename('我的 演示/v1', 'pptx')).toBe('我的 演示v1.pptx');
    expect(buildExportFilename('   ', 'pptx')).toBe('presentation.pptx');
  });
});
