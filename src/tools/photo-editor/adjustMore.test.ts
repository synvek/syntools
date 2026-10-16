import { describe, expect, it } from 'vitest';
import {
  NO_ADJUSTMENTS,
  defaultChannelMixer,
  defaultPhotoFilter,
  defaultReplaceColor,
  defaultSelectiveColor,
  defaultShadowsHighlights,
  hasExtendedAdjustments,
  needsPixelPass,
} from './core';
import {
  applyChannelMixer,
  applyPhotoFilter,
  applyReplaceColor,
  applySelectiveColor,
  applyShadowsHighlights,
  cmykToRgb,
  hslToRgb,
  rgbToCmyk,
  rgbToHsl,
  selectiveWeight,
} from './render/adjustMore';
import type { SelectiveRange } from './model/types';

const px = (r: number, g: number, b: number, a = 255) => new Uint8ClampedArray([r, g, b, a]);
const read = (data: Uint8ClampedArray, index = 0) => [
  data[index * 4],
  data[index * 4 + 1],
  data[index * 4 + 2],
  data[index * 4 + 3],
];
/** 断言像素值（`Uint8ClampedArray` 会取整，因此用显式容差） */
const expectRgb = (data: Uint8ClampedArray, expected: number[], delta = 1) => {
  const actual = read(data);
  expected.forEach((value, i) => {
    expect(Math.abs(actual[i] - value)).toBeLessThanOrEqual(delta);
  });
};

describe('HSL / CMYK 转换', () => {
  it('RGB → HSL → RGB 往返一致', () => {
    for (const [r, g, b] of [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [128, 128, 128],
      [12, 200, 90],
    ]) {
      const [h, s, l] = rgbToHsl(r, g, b);
      const [nr, ng, nb] = hslToRgb(h, s, l);
      expect([nr, ng, nb]).toEqual([r, g, b]);
    }
  });

  it('灰色没有色相与饱和度', () => {
    const [h, s] = rgbToHsl(128, 128, 128);
    expect(h).toBe(0);
    expect(s).toBe(0);
  });

  it('CMYK 往返一致（黑色单独处理）', () => {
    const [c, m, y, k] = rgbToCmyk(12, 200, 90);
    const [r, g, b] = cmykToRgb(c, m, y, k);
    expect(r).toBeCloseTo(12, -1);
    expect(g).toBeCloseTo(200, -1);
    expect(b).toBeCloseTo(90, -1);
    expect(rgbToCmyk(0, 0, 0)).toEqual([0, 0, 0, 1]);
  });
});

describe('selectiveWeight：色域归属', () => {
  it('纯红只落在红色域', () => {
    const [h, s, l] = rgbToHsl(255, 0, 0);
    expect(selectiveWeight('reds', h, s, l)).toBeCloseTo(1, 2);
    expect(selectiveWeight('greens', h, s, l)).toBe(0);
    expect(selectiveWeight('blues', h, s, l)).toBe(0);
  });

  it('相邻色域有交叠（±60° 三角窗）', () => {
    const [h, s, l] = rgbToHsl(255, 128, 0); // 橙色，介于红与黄之间
    expect(selectiveWeight('reds', h, s, l)).toBeGreaterThan(0);
    expect(selectiveWeight('yellows', h, s, l)).toBeGreaterThan(0);
  });

  it('灰色只落在白 / 中性 / 黑，且三段互补', () => {
    const mid = rgbToHsl(128, 128, 128);
    expect(selectiveWeight('neutrals', mid[0], mid[1], mid[2])).toBeCloseTo(1, 2);
    expect(selectiveWeight('reds', mid[0], mid[1], mid[2])).toBe(0);

    // 白 / 中性 / 黑按明度线性过渡，三段权重之和恒为 1
    for (const level of [10, 64, 128, 200, 240]) {
      const [h, s, l] = rgbToHsl(level, level, level);
      const total =
        selectiveWeight('whites', h, s, l) +
        selectiveWeight('neutrals', h, s, l) +
        selectiveWeight('blacks', h, s, l);
      expect(total).toBeCloseTo(1, 2);
    }

    const light = rgbToHsl(240, 240, 240);
    expect(selectiveWeight('whites', light[0], light[1], light[2])).toBeGreaterThan(0.8);
    const dark = rgbToHsl(10, 10, 10);
    expect(selectiveWeight('blacks', dark[0], dark[1], dark[2])).toBeGreaterThan(0.9);
  });
});

describe('照片滤镜', () => {
  it('浓度为 0 时画面不变', () => {
    const data = px(120, 80, 40);
    applyPhotoFilter(data, { ...defaultPhotoFilter(), density: 0 });
    expectRgb(data, [120, 80, 40], 0.5);
  });

  it('偏暖滤镜把中灰推向暖色', () => {
    const data = px(128, 128, 128);
    applyPhotoFilter(data, {
      color: '#EC8A00',
      density: 60,
      preserveLuminosity: false,
    });
    expect(data[0]).toBeGreaterThan(128);
    expect(data[2]).toBeLessThan(128);
  });

  it('保持明度时亮度基本不变', () => {
    const data = px(128, 128, 128);
    applyPhotoFilter(data, { color: '#EC8A00', density: 60, preserveLuminosity: true });
    const luma = data[0] * 0.299 + data[1] * 0.587 + data[2] * 0.114;
    expect(luma).toBeCloseTo(128, -1);
  });
});

describe('通道混合器', () => {
  it('恒等参数不改变画面', () => {
    const data = px(10, 90, 200);
    applyChannelMixer(data, defaultChannelMixer());
    expectRgb(data, [10, 90, 200], 0.5);
  });

  it('互换红蓝输出通道', () => {
    const data = px(10, 90, 200);
    applyChannelMixer(data, {
      red: [0, 0, 100, 0],
      green: [0, 100, 0, 0],
      blue: [100, 0, 0, 0],
    });
    expectRgb(data, [200, 90, 10], 0.5);
  });

  it('常数按百分点加到通道上（25% ≈ +63.75）', () => {
    const data = px(0, 0, 0);
    applyChannelMixer(data, { red: [0, 0, 0, 25], green: [0, 0, 0, 0], blue: [0, 0, 0, -100] });
    expect(data[0]).toBeCloseTo(64, -1);
    expect(data[2]).toBe(0);
  });
});

describe('阴影 / 高光', () => {
  it('提亮暗部，对亮部影响很小', () => {
    const dark = px(20, 20, 20);
    const bright = px(235, 235, 235);
    const params = { ...defaultShadowsHighlights(), shadows: 80, highlights: 0 };
    applyShadowsHighlights(dark, params);
    applyShadowsHighlights(bright, params);
    expect(dark[0]).toBeGreaterThan(40);
    expect(bright[0] - 235).toBeLessThan(3);
  });

  it('压暗亮部，对暗部影响很小', () => {
    const dark = px(20, 20, 20);
    const bright = px(235, 235, 235);
    const params = { shadows: 0, highlights: 80 };
    applyShadowsHighlights(dark, params);
    applyShadowsHighlights(bright, params);
    expect(bright[0]).toBeLessThan(215);
    expect(Math.abs(dark[0] - 20)).toBeLessThan(2);
  });

  it('两个参数都为 0 时不做任何改动', () => {
    const data = px(30, 150, 240);
    applyShadowsHighlights(data, { shadows: 0, highlights: 0 });
    expectRgb(data, [30, 150, 240], 0.5);
  });
});

describe('可选颜色', () => {
  const withRange = (range: SelectiveRange, values: number[]) => {
    const params = defaultSelectiveColor();
    params.ranges[range] = values;
    return params;
  };

  it('全部为 0 时画面不变', () => {
    const data = px(200, 30, 30);
    applySelectiveColor(data, defaultSelectiveColor());
    expectRgb(data, [200, 30, 30], 0.5);
  });

  it('加青色会吸走红像素的红分量，灰像素不受影响', () => {
    const red = px(200, 30, 30);
    const gray = px(128, 128, 128);
    applySelectiveColor(red, withRange('reds', [50, 0, 0, 0]));
    applySelectiveColor(gray, withRange('reds', [50, 0, 0, 0]));
    // 青墨吸红：只有红通道下降，绿 / 蓝保持
    expect(red[0]).toBeLessThan(150);
    expect(red[1]).toBeCloseTo(30, -1);
    expectRgb(gray, [128, 128, 128], 1);
  });

  it('加洋红只会拉低绿通道', () => {
    const red = px(200, 30, 30);
    applySelectiveColor(red, withRange('reds', [0, 50, 0, 0]));
    expect(red[1]).toBeLessThan(30);
    expect(red[0]).toBeCloseTo(200, -2);
  });

  it('白色域只作用于高亮低饱和像素', () => {
    const white = px(250, 250, 250);
    const mid = px(128, 128, 128);
    applySelectiveColor(white, withRange('whites', [0, 0, 0, 40]));
    applySelectiveColor(mid, withRange('whites', [0, 0, 0, 40]));
    expect(white[0]).toBeLessThan(250);
    expect(mid[0]).toBeCloseTo(128, -1);
  });
});

describe('替换颜色', () => {
  it('偏移量全为 0 时画面不变', () => {
    const data = px(255, 0, 0);
    applyReplaceColor(data, { ...defaultReplaceColor(), hue: 0, saturation: 0, lightness: 0 });
    expectRgb(data, [255, 0, 0], 0.5);
  });

  it('色相 +120° 把红色替换为绿色（容差内）', () => {
    const data = px(255, 0, 0);
    applyReplaceColor(data, { ...defaultReplaceColor(), hue: 120, fuzziness: 200 });
    expect(data[1]).toBeGreaterThan(200);
    expect(data[0]).toBeLessThan(60);
  });

  it('容差外的像素不受影响', () => {
    const data = px(0, 0, 255);
    applyReplaceColor(data, {
      color: '#FF0000',
      hue: 120,
      saturation: 0,
      lightness: 0,
      fuzziness: 40,
    });
    expectRgb(data, [0, 0, 255], 0.5);
  });

  it('容差边缘是平滑过渡（强度随距离衰减）', () => {
    const near = px(250, 0, 0);
    const far = px(200, 0, 0);
    const params = { color: '#FF0000', hue: 120, saturation: 0, lightness: 0, fuzziness: 100 };
    applyReplaceColor(near, params);
    applyReplaceColor(far, params);
    // 越接近目标色，绿色分量越高
    expect(near[1]).toBeGreaterThan(far[1]);
  });
});

describe('更多调整接入像素通道判定', () => {
  it('启用任一扩展调整都需要像素通道', () => {
    const base = { ...NO_ADJUSTMENTS };
    expect(hasExtendedAdjustments(base)).toBe(false);
    expect(needsPixelPass(base, [])).toBe(false);
    for (const patch of [
      { photoFilter: defaultPhotoFilter() },
      { channelMixer: defaultChannelMixer() },
      { shadowsHighlights: defaultShadowsHighlights() },
      { selectiveColor: defaultSelectiveColor() },
      { replaceColor: defaultReplaceColor() },
    ]) {
      const adjustments = { ...base, ...patch };
      expect(hasExtendedAdjustments(adjustments)).toBe(true);
      expect(needsPixelPass(adjustments, [])).toBe(true);
    }
  });
});
