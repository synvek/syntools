import { describe, expect, it } from 'vitest';
import { FILTER_GROUPS, FILTER_PARAMS, FILTERS } from './core';
import {
  applyClouds,
  applyFindEdges,
  applyLensFlare,
  applyPinch,
  applyReduceNoise,
  applySpherize,
  applyTraceContour,
  applyTwirl,
  isExtraFilter,
  sampleBilinear,
} from './render/filterExtra';

/**
 * 扩展滤镜（扭曲 / 风格化 / 渲染 / 降噪）的像素级测试。
 *
 * 这些实现全是「就地修改 RGBA 数据」的纯函数，因此可以在 jsdom 下直接断言；
 * 其中**纯色不变性**（uniform image 经过几何变换后仍应均匀）是几何类滤镜最有效的回归防线：
 * 反向映射一旦搞错采样坐标，纯色图会立刻出现条纹或空洞。
 */

const rgba = (pixels: number[][]): Uint8ClampedArray => Uint8ClampedArray.from(pixels.flat());

const flat = (width: number, height: number, color: number[]): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = color[0];
    data[index * 4 + 1] = color[1];
    data[index * 4 + 2] = color[2];
    data[index * 4 + 3] = 255;
  }
  return data;
};

/** 断言整个缓冲的颜色都一样（允许 1 个字节的插值误差） */
const expectUniform = (data: Uint8ClampedArray, expected: number[]) => {
  for (let index = 0; index < data.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      expect(Math.abs(data[index + channel] - expected[channel])).toBeLessThanOrEqual(1);
    }
  }
};

const pixel = (data: Uint8ClampedArray, width: number, x: number, y: number) => {
  const offset = (y * width + x) * 4;
  return [data[offset], data[offset + 1], data[offset + 2]];
};

describe('滤镜清单与分组一致性', () => {
  it('分组完整覆盖 FILTERS，且没有重复项', () => {
    const grouped = FILTER_GROUPS.flatMap((group) => group.items);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual([...FILTERS].sort());
  });

  it('每个滤镜都有参数描述（可为空数组）', () => {
    for (const id of FILTERS) expect(Array.isArray(FILTER_PARAMS[id])).toBe(true);
  });

  it('扩展滤镜共 8 个，且都必须走像素管线（CSS 表达不了）', () => {
    const extra = FILTERS.filter((id) => isExtraFilter(id));
    expect(extra).toEqual([
      'twirl',
      'spherize',
      'pinch',
      'findEdges',
      'traceContour',
      'clouds',
      'lensFlare',
      'reduceNoise',
    ]);
  });
});

describe('sampleBilinear', () => {
  it('整数坐标取原像素', () => {
    const data = rgba([
      [10, 20, 30, 255],
      [40, 50, 60, 255],
    ]);
    expect(sampleBilinear(data, 2, 1, 0, 0)).toEqual([10, 20, 30, 255]);
    expect(sampleBilinear(data, 2, 1, 1, 0)).toEqual([40, 50, 60, 255]);
  });

  it('中点取两像素均值', () => {
    const data = rgba([
      [0, 0, 0, 255],
      [100, 100, 100, 255],
    ]);
    expect(sampleBilinear(data, 2, 1, 0.5, 0)).toEqual([50, 50, 50, 255]);
  });

  it('越界钳制到边缘像素（否则扭曲后会出现透明缺口）', () => {
    const data = flat(2, 2, [200, 200, 200]);
    expect(sampleBilinear(data, 2, 2, -5, 0)).toEqual([200, 200, 200, 255]);
    expect(sampleBilinear(data, 2, 2, 0, 9)).toEqual([200, 200, 200, 255]);
  });
});

describe('扭曲类：纯色不变性是几何正确性的基线', () => {
  const color = [120, 80, 40];

  it('旋转扭曲：角度 0 不改画面；纯色图不管扭多少都仍均匀', () => {
    const data = flat(9, 9, color);
    const before = [...data];
    applyTwirl(9, 9, data, 0);
    expect([...data]).toEqual(before);

    applyTwirl(9, 9, data, 180);
    expectUniform(data, color);
  });

  it('旋转扭曲：中心保持不动', () => {
    const data = flat(9, 9, [10, 10, 10]);
    // 中心 + 一个偏心的亮点：中心像素不应被搬走
    data[(4 * 9 + 4) * 4] = 250;
    applyTwirl(9, 9, data, 90);
    expect(data[(4 * 9 + 4) * 4]).toBeGreaterThan(200);
  });

  it('球面化：0 不改；纯色保持均匀；中心不动', () => {
    const data = flat(9, 9, [60, 60, 60]);
    const before = [...data];
    applySpherize(9, 9, data, 0);
    expect([...data]).toEqual(before);

    applySpherize(9, 9, data, 80);
    expectUniform(data, [60, 60, 60]);
    expect(pixel(data, 9, 4, 4)).toEqual([60, 60, 60]);
  });

  it('挤压：0 不改；纯色保持均匀', () => {
    const data = flat(9, 9, [30, 90, 150]);
    const before = [...data];
    applyPinch(9, 9, data, 0);
    expect([...data]).toEqual(before);

    applyPinch(9, 9, data, 100);
    expectUniform(data, [30, 90, 150]);
  });
});

describe('风格化：边缘检测', () => {
  /** 左黑右白的竖直台阶 */
  const stepImage = (width = 6, height = 4) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = x < width / 2 ? 0 : 255;
        const offset = (y * width + x) * 4;
        data[offset] = value;
        data[offset + 1] = value;
        data[offset + 2] = value;
        data[offset + 3] = 255;
      }
    }
    return data;
  };

  it('查找边缘：平坦区域为白，边界处变暗', () => {
    const flatData = flat(5, 5, [128, 128, 128]);
    applyFindEdges(5, 5, flatData);
    expectUniform(flatData, [255, 255, 255]);

    const data = stepImage();
    applyFindEdges(6, 4, data);
    expect(pixel(data, 6, 3, 1)[0]).toBeLessThan(255);
    expect(pixel(data, 6, 0, 1)[0]).toBe(255);
  });

  it('等高线：低于阈值处为白，边界处按阈值压黑', () => {
    const flatData = flat(5, 5, [128, 128, 128]);
    applyTraceContour(5, 5, flatData, 128);
    expectUniform(flatData, [255, 255, 255]);

    const data = stepImage();
    applyTraceContour(6, 4, data, 128);
    const boundary = [pixel(data, 6, 2, 1)[0], pixel(data, 6, 3, 1)[0]];
    expect(boundary).toContain(0);
  });

  it('阈值越高越容易画出等高线', () => {
    const low = stepImage();
    const high = stepImage();
    applyTraceContour(6, 4, low, 40);
    applyTraceContour(6, 4, high, 900);
    const countBlack = (data: Uint8ClampedArray) =>
      data.reduce((sum, value, index) => (index % 4 === 0 && value === 0 ? sum + 1 : sum), 0);
    expect(countBlack(low)).toBeGreaterThanOrEqual(countBlack(high));
  });
});

describe('渲染类', () => {
  it('云彩：确定性（同参数重复烘焙结果一致）', () => {
    const a = flat(16, 16, [0, 0, 0]);
    const b = flat(16, 16, [0, 0, 0]);
    applyClouds(16, 16, a, 80, 16);
    applyClouds(16, 16, b, 80, 16);
    expect([...a]).toEqual([...b]);
  });

  it('云彩：强度 0 不改；强度 100 后被完全替换为噪声（出现明暗起伏）', () => {
    const untouched = flat(16, 16, [10, 20, 30]);
    const before = [...untouched];
    applyClouds(16, 16, untouched, 0, 16);
    expect([...untouched]).toEqual(before);

    const data = flat(24, 24, [0, 0, 0]);
    applyClouds(24, 24, data, 100, 8);
    const values = data.filter((_, index) => index % 4 === 0);
    expect(Math.max(...values)).toBeGreaterThan(40);
    expect(Math.min(...values)).toBeLessThan(240);
  });

  it('镜头光晕：0 不改；光斑处变亮、远处几乎不受影响', () => {
    const data = flat(40, 40, [0, 0, 0]);
    const before = [...data];
    applyLensFlare(40, 40, data, 0, 40, 50, 50);
    expect([...data]).toEqual(before);

    applyLensFlare(40, 40, data, 100, 40, 50, 50);
    const center = pixel(data, 40, 20, 20)[0];
    const corner = pixel(data, 40, 0, 0)[0];
    // 中心显著变亮；角落即使正好落在某道鬼影光环上，也必须远弱于中心
    expect(center).toBeGreaterThan(150);
    expect(corner).toBeLessThan(center * 0.25);
  });
});

describe('降噪：中值滤波', () => {
  it('强度 0 不改画面', () => {
    const data = flat(5, 5, [100, 100, 100]);
    const before = [...data];
    applyReduceNoise(5, 5, data, 0, 1);
    expect([...data]).toEqual(before);
  });

  it('纯色图像保持均匀', () => {
    const data = flat(7, 7, [77, 88, 99]);
    applyReduceNoise(7, 7, data, 100, 1);
    expectUniform(data, [77, 88, 99]);
  });

  it('孤立亮点被抹平（椒盐噪声）', () => {
    const data = flat(5, 5, [0, 0, 0]);
    const center = (2 * 5 + 2) * 4;
    data[center] = 255;
    data[center + 1] = 255;
    data[center + 2] = 255;
    applyReduceNoise(5, 5, data, 100, 1);
    expect(pixel(data, 5, 2, 2)).toEqual([0, 0, 0]);
  });

  it('强度 50 时只削弱一半', () => {
    const data = flat(5, 5, [0, 0, 0]);
    const center = (2 * 5 + 2) * 4;
    data[center] = 200;
    data[center + 1] = 200;
    data[center + 2] = 200;
    applyReduceNoise(5, 5, data, 50, 1);
    expect(pixel(data, 5, 2, 2)[0]).toBe(100);
  });

  it('半径为 3 时更大的斑块也会被抹掉', () => {
    const data = flat(9, 9, [0, 0, 0]);
    for (const [x, y] of [
      [4, 4],
      [5, 4],
      [4, 5],
    ]) {
      const offset = (y * 9 + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
    }
    applyReduceNoise(9, 9, data, 100, 3);
    expect(pixel(data, 9, 4, 4)).toEqual([0, 0, 0]);
  });
});
