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
  computeAlign,
  computeDistribute,
  unionBounds,
  normalizeAngle,
  containInto,
  fitScale,
  buildExportFilename,
  type AlignBox,
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

  it('网格吸附：无对齐命中时吸附到最近网格线', () => {
    const result = computeSnap(
      { x: 103, y: 47, width: 50, height: 30 },
      [],
      { width: 400, height: 300 },
      6,
      { grid: 24 },
    );
    // 103 → 96（24 的倍数），47 → 48
    expect(result.x).toBe(96);
    expect(result.y).toBe(48);
    // 网格吸附不产生参考线
    expect(result.guides).toHaveLength(0);
  });

  it('手动参考线参与吸附并产生参考线', () => {
    const result = computeSnap(
      { x: 197, y: 10, width: 40, height: 20 },
      [],
      { width: 400, height: 300 },
      6,
      { extraX: [200], extraY: [] },
    );
    expect(result.x).toBe(200);
    expect(result.guides.some((guide) => guide.axis === 'x' && guide.position === 200)).toBe(true);
  });

  it('网格关闭时不吸附', () => {
    const result = computeSnap({ x: 103, y: 47, width: 50, height: 30 }, [], {
      width: 400,
      height: 300,
    });
    expect(result.x).toBe(103);
    expect(result.y).toBe(47);
  });

  it('导出文件名清洗', () => {
    expect(buildExportFilename('我的 演示/v1', 'pptx')).toBe('我的 演示v1.pptx');
    expect(buildExportFilename('   ', 'pptx')).toBe('presentation.pptx');
  });
});

describe('对齐与分布', () => {
  const page: AlignBox = { x: 0, y: 0, width: 1280, height: 720 };

  it('unionBounds 求并集包围盒', () => {
    expect(
      unionBounds([
        { x: 10, y: 20, width: 100, height: 50 },
        { x: 200, y: 5, width: 60, height: 40 },
      ]),
    ).toEqual({ x: 10, y: 5, width: 250, height: 65 });
    expect(unionBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('多选左对齐：对齐到选中元素的包围盒左边缘', () => {
    const targets = [
      { x: 10, y: 0, width: 100, height: 50 },
      { x: 300, y: 80, width: 60, height: 40 },
    ];
    expect(computeAlign('left', targets, unionBounds(targets))).toEqual([
      { dx: 0, dy: 0 },
      { dx: -290, dy: 0 },
    ]);
  });

  it('单选对齐：对齐到页面', () => {
    const single = [{ x: 120, y: 60, width: 200, height: 100 }];
    expect(computeAlign('left', single, page)).toEqual([{ dx: -120, dy: 0 }]);
    expect(computeAlign('right', single, page)).toEqual([{ dx: 960, dy: 0 }]);
    expect(computeAlign('hcenter', single, page)).toEqual([{ dx: 420, dy: 0 }]);
    expect(computeAlign('top', single, page)).toEqual([{ dx: 0, dy: -60 }]);
    expect(computeAlign('bottom', single, page)).toEqual([{ dx: 0, dy: 560 }]);
    expect(computeAlign('vcenter', single, page)).toEqual([{ dx: 0, dy: 250 }]);
  });

  it('等间距分布：首末不动，中间间隙相等', () => {
    // 三个等宽 100 的盒子，跨度 500 → 间隙 (500-300)/2 = 100
    const targets = [
      { x: 0, y: 0, width: 100, height: 50 },
      { x: 50, y: 0, width: 100, height: 50 },
      { x: 400, y: 0, width: 100, height: 50 },
    ];
    const deltas = computeDistribute('horizontal', targets);
    expect(deltas[0]).toEqual({ dx: 0, dy: 0 });
    expect(deltas[2]).toEqual({ dx: 0, dy: 0 });
    expect(targets[1].x + deltas[1].dx).toBe(200);
  });

  it('少于 3 个对象时分布为空操作', () => {
    const targets = [
      { x: 0, y: 0, width: 100, height: 50 },
      { x: 400, y: 0, width: 100, height: 50 },
    ];
    expect(computeDistribute('horizontal', targets)).toEqual([
      { dx: 0, dy: 0 },
      { dx: 0, dy: 0 },
    ]);
  });

  it('纵向分布按 y 轴排序', () => {
    const targets = [
      { x: 0, y: 0, width: 100, height: 40 },
      { x: 0, y: 30, width: 100, height: 40 },
      { x: 0, y: 300, width: 100, height: 40 },
    ];
    const deltas = computeDistribute('vertical', targets);
    // 跨度 340、总高 120 → 间隙 110，中间元素落到 y=150（首末保持 0 与 300）
    expect(deltas[0].dy).toBe(0);
    expect(deltas[2].dy).toBe(0);
    expect(targets[1].y + deltas[1].dy).toBe(150);
    expect(deltas.every((item) => item.dx === 0)).toBe(true);
  });
});
