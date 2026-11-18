import { describe, expect, it } from 'vitest';
import {
  dragRect,
  inkTrack,
  isUsableDrag,
  sampleTrack,
  simplifyTrack,
  trackRect,
  MIN_DRAG_SIZE,
} from './track';

describe('dragRect', () => {
  it('反向拖动也能得到正向矩形', () => {
    const rect = dragRect({ x: 0.4, y: 0.5 }, { x: 0.2, y: 0.3 });

    expect(rect.x).toBeCloseTo(0.2, 10);
    expect(rect.y).toBeCloseTo(0.3, 10);
    expect(rect.w).toBeCloseTo(0.2, 10);
    expect(rect.h).toBeCloseTo(0.2, 10);
  });

  it('越界的拖动被夹回页面内', () => {
    const rect = dragRect({ x: 0.9, y: 0.9 }, { x: 1.4, y: 1.6 });

    expect(rect.x).toBeCloseTo(0.9, 10);
    expect(rect.w).toBeCloseTo(0.1, 10);
    expect(rect.h).toBeCloseTo(0.1, 10);
  });
});

describe('isUsableDrag', () => {
  it('小于阈值的拖动视为误点击', () => {
    expect(isUsableDrag({ x: 0.5, y: 0.5, w: 0.001, h: 0.2 })).toBe(false);
    expect(isUsableDrag({ x: 0.5, y: 0.5, w: 0.001, h: 0.2 }, MIN_DRAG_SIZE)).toBe(false);
    expect(isUsableDrag({ x: 0.5, y: 0.5, w: 0.02, h: 0.02 })).toBe(true);
  });
});

describe('trackRect', () => {
  it('取折线的外接框', () => {
    const rect = trackRect([
      { x: 0.2, y: 0.3 },
      { x: 0.5, y: 0.1 },
      { x: 0.4, y: 0.6 },
    ]);

    expect(rect.x).toBeCloseTo(0.2, 10);
    expect(rect.y).toBeCloseTo(0.1, 10);
    expect(rect.w).toBeCloseTo(0.3, 10);
    expect(rect.h).toBeCloseTo(0.5, 10);
  });

  it('空折线返回零矩形', () => {
    expect(trackRect([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe('sampleTrack', () => {
  it('丢掉与上一个点过近的采样', () => {
    const sampled = sampleTrack(
      [
        { x: 0.1, y: 0.1 },
        { x: 0.1005, y: 0.1 },
        { x: 0.12, y: 0.1 },
      ],
      0.001,
    );

    expect(sampled).toHaveLength(2);
    expect(sampled[1].x).toBeCloseTo(0.12, 10);
  });
});

describe('simplifyTrack', () => {
  it('直线段只保留首尾', () => {
    const simplified = simplifyTrack([
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.2 },
      { x: 0.3, y: 0.3 },
      { x: 0.4, y: 0.4 },
    ]);

    expect(simplified).toEqual([
      { x: 0.1, y: 0.1 },
      { x: 0.4, y: 0.4 },
    ]);
  });

  it('偏离直线的拐点被保留', () => {
    const simplified = simplifyTrack([
      { x: 0.1, y: 0.1 },
      { x: 0.25, y: 0.3 },
      { x: 0.4, y: 0.1 },
    ]);

    expect(simplified).toHaveLength(3);
  });

  it('两个点及以下原样返回', () => {
    expect(simplifyTrack([{ x: 0.1, y: 0.1 }])).toEqual([{ x: 0.1, y: 0.1 }]);
    expect(simplifyTrack([])).toEqual([]);
  });
});

describe('inkTrack', () => {
  it('单点笔画被丢弃', () => {
    expect(inkTrack([{ x: 0.2, y: 0.2 }])).toEqual([]);
  });

  it('两点以上返回简化后的折线', () => {
    const points = inkTrack([
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.2 },
      { x: 0.3, y: 0.3 },
    ]);

    expect(points).toHaveLength(2);
  });
});
