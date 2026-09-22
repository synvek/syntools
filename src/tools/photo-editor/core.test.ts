import { describe, expect, it } from 'vitest';
import {
  BLEND_MODES,
  CANVAS_PRESETS,
  FILTERS,
  MAX_CANVAS_SIZE,
  MIN_CANVAS_SIZE,
  bakeSignature,
  buildFilterString,
  checkImageFile,
  checkProjectFile,
  clampBrushSize,
  clampPercent,
  clampRect,
  clampUnit,
  computeFitScale,
  formatBytes,
  hexToRgb,
  intersectRect,
  needsPixelPass,
  normalizeRect,
  pointInSelection,
  polygonBounds,
  rgbToHex,
  sanitizeFilename,
  simplifyPath,
} from './core';
import { createAdjustments } from './model/factory';
import type { Selection } from './model/types';

describe('钳制与格式化', () => {
  it('笔刷尺寸落在合法区间，非法值回落最小值', () => {
    expect(clampBrushSize(0)).toBe(1);
    expect(clampBrushSize(9999)).toBe(400);
    expect(clampBrushSize(Number.NaN)).toBe(1);
    expect(clampBrushSize(12.6)).toBe(13);
  });

  it('百分比与不透明度按区间取整', () => {
    expect(clampPercent(120)).toBe(100);
    expect(clampPercent(-120)).toBe(-100);
    expect(clampUnit(1.8)).toBe(1);
    expect(clampUnit(0.456)).toBe(0.46);
  });

  it('文件名清洗掉路径分隔符', () => {
    expect(sanitizeFilename('a/b:c*d?')).toBe('a-b-c-d-');
    expect(sanitizeFilename('   ')).toBe('photo');
  });

  it('字节格式化', () => {
    expect(formatBytes(512)).toBe('512B');
    expect(formatBytes(2048)).toBe('2KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0MB');
  });
});

describe('颜色', () => {
  it('hex 与 rgb 互转', () => {
    expect(hexToRgb('#2563EB')).toEqual({ r: 37, g: 99, b: 235 });
    expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 });
    expect(hexToRgb('nope')).toBeNull();
    expect(rgbToHex(37, 99, 235)).toBe('#2563EB');
  });
});

describe('调整参数 → 滤镜管线', () => {
  it('默认参数不产生任何 CSS filter', () => {
    expect(buildFilterString(createAdjustments())).toBe('');
  });

  it('亮度与曝光叠加，色相单独成段', () => {
    const result = buildFilterString({
      ...createAdjustments(),
      brightness: 20,
      hue: 90,
      saturation: -50,
    });
    expect(result).toContain('brightness(1.2)');
    expect(result).toContain('hue-rotate(90deg)');
    expect(result).toContain('saturate(0.5)');
  });

  it('色温 / 锐化 / 非 CSS 滤镜需要像素通道', () => {
    expect(needsPixelPass(createAdjustments(), ['grayscale'])).toBe(false);
    expect(needsPixelPass({ ...createAdjustments(), temperature: 10 }, [])).toBe(true);
    expect(needsPixelPass({ ...createAdjustments(), sharpen: 40 }, [])).toBe(true);
    expect(needsPixelPass(createAdjustments(), ['pixelate'])).toBe(true);
  });

  it('烘焙签名随参数与版本号变化', () => {
    const base = bakeSignature('asset-1', 1, createAdjustments(), []);
    const revChanged = bakeSignature('asset-1', 2, createAdjustments(), []);
    const paramChanged = bakeSignature(
      'asset-1',
      1,
      { ...createAdjustments(), brightness: 10 },
      [],
    );
    expect(base).not.toBe(revChanged);
    expect(base).not.toBe(paramChanged);
  });
});

describe('几何', () => {
  it('拖拽矩形归一化为正数宽高', () => {
    expect(normalizeRect({ x: 30, y: 40 }, { x: 10, y: 10 })).toEqual({
      x: 10,
      y: 10,
      width: 20,
      height: 30,
    });
  });

  it('矩形被裁剪到画布内', () => {
    const clamped = clampRect(
      { x: -10, y: 90, width: 100, height: 100 },
      { width: 100, height: 100 },
    );
    expect(clamped).toEqual({ x: 0, y: 90, width: 100, height: 10 });
  });

  it('相交与不相交', () => {
    expect(
      intersectRect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }),
    ).toEqual({
      x: 5,
      y: 5,
      width: 5,
      height: 5,
    });
    expect(
      intersectRect({ x: 0, y: 0, width: 5, height: 5 }, { x: 10, y: 10, width: 5, height: 5 }),
    ).toBeNull();
  });

  it('适配缩放留出边距且不放大小图', () => {
    // 可宽 460 / 可高 260 → 取较小的 0.46
    expect(
      computeFitScale({ width: 1000, height: 500 }, { width: 500, height: 300 }, 20),
    ).toBeCloseTo(0.46, 2);
    expect(computeFitScale({ width: 100, height: 100 }, { width: 1000, height: 1000 }, 20)).toBe(1);
  });

  it('套索顶点抽稀并计算外接矩形', () => {
    const path = [0, 0, 1, 0, 2, 0, 3, 0, 30, 20];
    expect(simplifyPath(path).length).toBeLessThan(path.length);
    expect(polygonBounds([0, 0, 10, 20])).toEqual({ x: 0, y: 0, width: 10, height: 20 });
  });
});

describe('选区命中', () => {
  const rect: Selection = {
    kind: 'rect',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    path: [],
    feather: 0,
  };
  const ellipse: Selection = { ...rect, kind: 'ellipse' };
  const lasso: Selection = {
    ...rect,
    kind: 'lasso',
    path: [0, 0, 100, 0, 100, 50, 0, 50],
  };

  it('矩形选区按外接矩形判定', () => {
    expect(pointInSelection(rect, 50, 25)).toBe(true);
    expect(pointInSelection(rect, 120, 25)).toBe(false);
  });

  it('椭圆选区排除四角', () => {
    expect(pointInSelection(ellipse, 50, 25)).toBe(true);
    expect(pointInSelection(ellipse, 2, 2)).toBe(false);
  });

  it('套索按多边形判定', () => {
    expect(pointInSelection(lasso, 50, 25)).toBe(true);
    expect(pointInSelection(lasso, -5, 25)).toBe(false);
  });
});

describe('文件校验', () => {
  it('图片扩展名 / 空文件 / 超限', () => {
    expect(checkImageFile({ name: 'a.png', size: 1024 }).ok).toBe(true);
    expect(checkImageFile({ name: 'a.txt', size: 1024 })).toEqual({
      ok: false,
      error: 'NOT_IMAGE',
    });
    expect(checkImageFile({ name: 'a.png', size: 0 })).toEqual({ ok: false, error: 'EMPTY' });
    const tooLarge = checkImageFile({ name: 'a.jpg', size: 40 * 1024 * 1024 });
    expect(tooLarge.ok).toBe(false);
    if (!tooLarge.ok) expect(tooLarge.params?.max).toBe(30);
  });

  it('工程文件必须是 json', () => {
    expect(checkProjectFile({ name: 'a.photo.json', size: 100 }).ok).toBe(true);
    expect(checkProjectFile({ name: 'a.png', size: 100 })).toEqual({
      ok: false,
      error: 'NOT_PROJECT',
    });
  });
});

describe('工具常量', () => {
  it('预设尺寸都在合法范围内', () => {
    for (const preset of CANVAS_PRESETS) {
      expect(preset.width).toBeGreaterThanOrEqual(MIN_CANVAS_SIZE);
      expect(preset.height).toBeLessThanOrEqual(MAX_CANVAS_SIZE);
    }
  });

  it('混合模式与滤镜枚举可用于下拉', () => {
    expect(BLEND_MODES[0].id).toBe('normal');
    expect(FILTERS.length).toBeGreaterThanOrEqual(10);
    expect(FILTERS.map((item) => item.id)).toContain('grayscale');
  });
});
