import { describe, expect, it } from 'vitest';
import {
  MAX_STAMPS_PER_MOVE,
  REPAIR_SPACING,
  REPAIR_TOOLS,
  healOffset,
  mixChannel,
  needsCloneSource,
  stampFalloff,
  walkStamps,
} from './core';
import { boxBlurRgba } from './render/repair';

/**
 * 润饰 / 修复族的纯逻辑测试。
 *
 * 印章步进、边缘衰减、色彩匹配、盒式模糊都是可以直接断言的纯函数；
 * 真正的像素读写依赖 Canvas2D（jsdom 没有），因此不在单测覆盖范围内。
 */

describe('工具族常量', () => {
  it('修复族共 6 个工具', () => {
    expect(REPAIR_TOOLS).toHaveLength(6);
    expect(REPAIR_TOOLS).toContain('cloneStamp');
    expect(REPAIR_TOOLS).toContain('sharpenBrush');
  });

  it('只有图章与修复画笔需要手动取样', () => {
    expect(needsCloneSource('cloneStamp')).toBe(true);
    expect(needsCloneSource('healing')).toBe(true);
    expect(needsCloneSource('spotHeal')).toBe(false);
    expect(needsCloneSource('smudge')).toBe(false);
    expect(needsCloneSource('blurBrush')).toBe(false);
    expect(needsCloneSource('brush')).toBe(false);
  });

  it('修复族的印章间距比减淡加深更小（要连续）', () => {
    expect(REPAIR_SPACING).toBeLessThan(0.25);
    expect(REPAIR_SPACING).toBeGreaterThan(0);
  });
});

describe('walkStamps：印章步进', () => {
  it('位移为零时不产生印章', () => {
    expect(walkStamps(10, 10, 10, 10, 5, 5).positions).toEqual([]);
  });

  it('按步长等距插值，并保留跨次调用的余量', () => {
    const step = walkStamps(0, 0, 10, 0, 5, 5);
    expect(step.positions).toEqual([
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ]);
    // 末枚印章正好落在终点：距下一枚还需前进一个步长
    expect(step.next).toBe(5);

    // 余量继续生效：从 10 走到 12，距下一枚还差 5
    const more = walkStamps(10, 0, 12, 0, 5, step.next);
    expect(more.positions).toEqual([]);
    expect(more.next).toBe(3);
  });

  it('斜向位移按真实距离步进（不是按坐标分量）', () => {
    // 3-4-5 直角三角形：走 (3,4) 共 5 像素
    const result = walkStamps(0, 0, 3, 4, 5, 5);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].x).toBeCloseTo(3, 6);
    expect(result.positions[0].y).toBeCloseTo(4, 6);
  });

  it('极端跳点被上限截断', () => {
    const result = walkStamps(0, 0, 1, 0, 1 / MAX_STAMPS_PER_MOVE, 1 / MAX_STAMPS_PER_MOVE);
    expect(result.positions.length).toBeLessThanOrEqual(MAX_STAMPS_PER_MOVE);
  });
});

describe('stampFalloff：边缘衰减', () => {
  it('中心 1、边缘 0、圆外 0', () => {
    expect(stampFalloff(0)).toBe(1);
    expect(stampFalloff(1)).toBe(0);
    expect(stampFalloff(1.2)).toBe(0);
  });

  it('单调递减', () => {
    let previous = stampFalloff(0);
    for (let distance = 0.1; distance <= 1; distance += 0.1) {
      const value = stampFalloff(distance);
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('healOffset / mixChannel：像素运算', () => {
  it('修复偏移 = 目标均值 - 源均值', () => {
    expect(healOffset([10, 20, 30], [12, 25, 27])).toEqual([2, 5, -3]);
  });

  it('缺失分量按 0 处理，不做 NaN 传播', () => {
    expect(healOffset([], [3, 4, 5])).toEqual([3, 4, 5]);
  });

  it('mixChannel 按权重线性混合并钳制', () => {
    expect(mixChannel(0, 100, 0.5)).toBe(50);
    expect(mixChannel(0, 100, 0)).toBe(0);
    expect(mixChannel(0, 100, 1)).toBe(100);
    expect(mixChannel(0, 100, 5)).toBe(100);
    expect(mixChannel(0, 100, Number.NaN)).toBe(0);
  });
});

describe('boxBlurRgba：可分离盒式模糊', () => {
  const make = (width: number, height: number, fill: number[]) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
      data[index * 4] = fill[0];
      data[index * 4 + 1] = fill[1];
      data[index * 4 + 2] = fill[2];
      data[index * 4 + 3] = 255;
    }
    return data;
  };

  it('纯色图像模糊后不变', () => {
    const data = make(4, 4, [120, 60, 30]);
    const out = boxBlurRgba(data, 4, 4, 1);
    expect([...out.slice(0, 4)]).toEqual([120, 60, 30, 255]);
  });

  it('单点亮斑被摊开到邻域（峰值下降）', () => {
    const data = make(5, 5, [0, 0, 0]);
    data[(2 * 5 + 2) * 4] = 255;
    const out = boxBlurRgba(data, 5, 5, 1);
    expect(out[(2 * 5 + 2) * 4]).toBeLessThan(255);
    expect(out[(2 * 5 + 2) * 4]).toBeGreaterThan(0);
    // 邻域也拿到了能量
    expect(out[(2 * 5 + 1) * 4]).toBeGreaterThan(0);
  });

  it('alpha 通道同样参与模糊（半透明边缘不会变硬）', () => {
    const data = new Uint8ClampedArray(3 * 1 * 4);
    data[0 * 4 + 3] = 255;
    const out = boxBlurRgba(data, 3, 1, 1);
    expect(out[1 * 4 + 3]).toBeGreaterThan(0);
    expect(out[1 * 4 + 3]).toBeLessThan(255);
  });

  it('尺寸为 1 或半径越界时不会崩溃（贴边印章的真实场景）', () => {
    const single = new Uint8ClampedArray([10, 20, 30, 255]);
    expect([...boxBlurRgba(single, 1, 1, 1)]).toEqual([10, 20, 30, 255]);
    const strip = make(1, 3, [200, 100, 50]);
    expect([...boxBlurRgba(strip, 1, 3, 2).slice(0, 4)]).toEqual([200, 100, 50, 255]);
  });
});
