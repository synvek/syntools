import { describe, expect, it } from 'vitest';
import {
  COLOR_CHANNELS,
  MAX_SAMPLES,
  extractChannelData,
  extractPalette,
  MASK_SELECTION_THRESHOLD,
  hexToRgb,
  maskRunsToParts,
  partsBounds,
  rgbToHex,
  selectionFromMask,
  selectionFromParts,
} from './core';
import { migrateDoc } from './model/migrate';
import type { PhotoDoc } from './model/types';

/** 构造 RGBA 数据：`pixels` 为 [r,g,b,a] 列表 */
function pixels(list: number[][]): Uint8ClampedArray {
  return new Uint8ClampedArray(list.flat());
}

describe('通道常量', () => {
  it('包含三个颜色通道，取样点上限为 4（与 Photoshop 一致）', () => {
    expect(COLOR_CHANNELS).toEqual(['red', 'green', 'blue']);
    expect(MAX_SAMPLES).toBe(4);
  });
});

describe('extractChannelData：单通道隔离', () => {
  it('红通道：三个分量都等于原 R（按灰度呈现，而不是显示成红色）', () => {
    const data = pixels([
      [10, 200, 30, 255],
      [255, 0, 128, 255],
    ]);
    extractChannelData(data, 'red');
    expect([...data]).toEqual([10, 10, 10, 255, 255, 255, 255, 255]);
  });

  it('绿 / 蓝通道取对应分量', () => {
    const green = pixels([[10, 200, 30, 255]]);
    extractChannelData(green, 'green');
    expect([...green].slice(0, 3)).toEqual([200, 200, 200]);

    const blue = pixels([[10, 200, 30, 255]]);
    extractChannelData(blue, 'blue');
    expect([...blue].slice(0, 3)).toEqual([30, 30, 30]);
  });

  it('保留 alpha 不变', () => {
    const data = pixels([[10, 200, 30, 40]]);
    extractChannelData(data, 'red');
    expect(data[3]).toBe(40);
  });
});

describe('maskRunsToParts：蒙版扫描线转选区', () => {
  it('把每行连续区段转成矩形并集', () => {
    // 2×2：第一行两像素选中，第二行仅左像素选中
    const data = new Uint8ClampedArray(2 * 2 * 4);
    for (const index of [0, 1, 2]) data[index * 4 + 3] = 255;
    const parts = maskRunsToParts(data, 2, 2, 128, 'alpha');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ path: [0, 0, 2, 0, 2, 1, 0, 1], add: true });
    expect(parts[1]).toEqual({ path: [0, 1, 1, 1, 1, 2, 0, 2], add: true });
  });

  it('全空蒙版产出空轮廓', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    expect(maskRunsToParts(data, 4, 4, 128, 'alpha')).toEqual([]);
  });

  it('默认按亮度判定（通道图 / 灰度蒙版用）', () => {
    // 白像素（亮度 255）选中、黑像素（亮度 0）不选中
    const data = pixels([
      [255, 255, 255, 255],
      [0, 0, 0, 255],
    ]);
    const parts = maskRunsToParts(data, 2, 1, 128);
    expect(parts).toHaveLength(1);
    expect(parts[0].path).toEqual([0, 0, 1, 0, 1, 1, 0, 1]);
  });

  it('阈值以下的半透明像素不算选中', () => {
    const data = new Uint8ClampedArray(2 * 1 * 4);
    data[3] = 100; // 第一像素 alpha=100 < 128
    data[7] = 200; // 第二像素 alpha=200
    const parts = maskRunsToParts(data, 2, 1, 128, 'alpha');
    expect(parts).toHaveLength(1);
    expect(parts[0].path).toEqual([1, 0, 2, 0, 2, 1, 1, 1]);
  });
});

describe('partsBounds / selectionFromParts', () => {
  it('由矩形并集反推包围盒', () => {
    const bounds = partsBounds([
      { path: [2, 3, 6, 3, 6, 4, 2, 4], add: true },
      { path: [4, 5, 9, 5, 9, 8, 4, 8], add: true },
    ]);
    expect(bounds).toEqual({ x: 2, y: 3, width: 7, height: 5 });
  });

  it('组装成套索选区，第一段为主轮廓、其余为并集', () => {
    const selection = selectionFromParts([
      { path: [0, 0, 4, 0, 4, 2, 0, 2], add: true },
      { path: [0, 2, 2, 2, 2, 4, 0, 4], add: true },
    ]);
    expect(selection).not.toBeNull();
    expect(selection?.kind).toBe('lasso');
    expect(selection?.parts).toHaveLength(2);
    expect(selection?.width).toBe(4);
    expect(selection?.height).toBe(4);
  });

  it('点数不足的轮廓被丢弃，全无效时返回 null', () => {
    expect(selectionFromParts([{ path: [0, 0, 1, 1], add: true }])).toBeNull();
    expect(selectionFromParts([])).toBeNull();
  });
});

describe('selectionFromMask：灰度蒙版转选区（快速蒙版退出 / 载入通道）', () => {
  it('白色区域成为选区，黑色区域不参与', () => {
    // 3×1：白 / 黑 / 白 —— 两段并集
    const data = pixels([
      [255, 255, 255, 255],
      [0, 0, 0, 255],
      [255, 255, 255, 255],
    ]);
    const selection = selectionFromMask(data, 3, 1);
    expect(selection).not.toBeNull();
    expect(selection?.parts).toHaveLength(2);
    expect(selection?.x).toBe(0);
    expect(selection?.width).toBe(3);
    expect(selection?.height).toBe(1);
  });

  it('全黑蒙版（没有选中任何内容）返回 null', () => {
    const data = new Uint8ClampedArray(2 * 2 * 4);
    expect(selectionFromMask(data, 2, 2)).toBeNull();
  });

  it('阈值可调：灰度 100 默认不算选中，阈值降到 80 则算', () => {
    const data = pixels([
      [100, 100, 100, 255],
      [0, 0, 0, 255],
    ]);
    expect(selectionFromMask(data, 2, 1)).toBeNull();
    expect(selectionFromMask(data, 2, 1, 80)).not.toBeNull();
    expect(MASK_SELECTION_THRESHOLD).toBe(128);
  });

  it('不透明但全黑的蒙版不等于「全选」（判据是亮度而非 alpha）', () => {
    const data = new Uint8ClampedArray(2 * 2 * 4).fill(255);
    // fill(255) 会把 RGB 也填成 255 → 全选；这里显式构造 alpha=255、RGB=0
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
    expect(selectionFromMask(data, 2, 2)).toBeNull();
  });
});

describe('extractPalette：主色提取', () => {
  it('取出占比最高的颜色并大写', () => {
    const list: number[][] = [];
    for (let i = 0; i < 50; i += 1) list.push([200, 20, 20, 255]);
    for (let i = 0; i < 20; i += 1) list.push([20, 20, 200, 255]);
    const palette = extractPalette(pixels(list), 4);
    expect(palette[0]).toBe('#C81414');
    expect(palette[1]).toBe('#1414C8');
  });

  it('跳过透明像素（避免透明区域的 0,0,0 顶进色板）', () => {
    const list: number[][] = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [10, 200, 30, 255],
    ];
    const palette = extractPalette(pixels(list), 4);
    expect(palette).toEqual(['#0AC81E']);
  });

  it('近色去重，不会用同色系占满名额', () => {
    const list: number[][] = [];
    for (let i = 0; i < 30; i += 1) list.push([120, 120, 120, 255]);
    for (let i = 0; i < 20; i += 1) list.push([128, 128, 128, 255]);
    for (let i = 0; i < 10; i += 1) list.push([0, 128, 0, 255]);
    const palette = extractPalette(pixels(list), 8);
    // 两个灰色域距离很近 → 只保留一个
    expect(palette).toHaveLength(2);
  });

  it('空数据返回空色板', () => {
    expect(extractPalette(new Uint8ClampedArray(0), 4)).toEqual([]);
  });

  it('rgbToHex / hexToRgb 往返一致（并钳制越界分量）', () => {
    expect(rgbToHex(10, 200, 30)).toBe('#0AC81E');
    expect(rgbToHex(-5, 300, 30)).toBe('#00FF1E');
    expect(hexToRgb('#0AC81E')).toEqual({ r: 10, g: 200, b: 30 });
    expect(hexToRgb('nope')).toBeNull();
  });
});

describe('migrateDoc：文档色板归一', () => {
  const raw = (swatches: unknown) => ({
    id: 'doc-1',
    name: 'n',
    width: 100,
    height: 100,
    background: 'white',
    layers: [],
    activeLayerId: null,
    swatches,
  });

  function parse(input: unknown): PhotoDoc {
    const parsed = migrateDoc(input);
    if (!parsed) throw new Error('migrateDoc 返回 null');
    return parsed;
  }

  it('旧工程没有 swatches 字段时补空数组', () => {
    expect(parse(raw(undefined)).swatches).toEqual([]);
  });

  it('过滤非法颜色、去重并大写化', () => {
    const parsed = parse(raw(['#ffffff', 'red', '#FFFFFF', '#0ac81e']));
    expect(parsed.swatches).toEqual(['#FFFFFF', '#0AC81E']);
  });

  it('超过容量上限时截断', () => {
    const many = Array.from({ length: 40 }, (_, i) => `#${(i * 3).toString(16).padStart(6, '0')}`);
    expect(parse(raw(many)).swatches.length).toBeLessThanOrEqual(32);
  });
});
