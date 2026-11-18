import { describe, expect, it } from 'vitest';
import type { NormRect } from '../model/types';
import {
  angleFromCenter,
  handlePoint,
  resizeRect,
  RESIZE_HANDLES,
  rotateDelta,
  snapAngle,
} from './handles';

const RECT: NormRect = { x: 0.2, y: 0.2, w: 0.4, h: 0.2 };

/** Normalized geometry is float math; compare component-wise instead of structurally */
function expectRect(actual: NormRect, expected: NormRect) {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
  expect(actual.w).toBeCloseTo(expected.w, 10);
  expect(actual.h).toBeCloseTo(expected.h, 10);
}

function expectPoint(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
}

describe('handlePoint', () => {
  it('八个手柄落在矩形的角与边中点上', () => {
    expect(RESIZE_HANDLES).toHaveLength(8);
    expectPoint(handlePoint(RECT, 'nw'), { x: 0.2, y: 0.2 });
    expectPoint(handlePoint(RECT, 'n'), { x: 0.4, y: 0.2 });
    expectPoint(handlePoint(RECT, 'ne'), { x: 0.6, y: 0.2 });
    expectPoint(handlePoint(RECT, 'e'), { x: 0.6, y: 0.3 });
    expectPoint(handlePoint(RECT, 'se'), { x: 0.6, y: 0.4 });
    expectPoint(handlePoint(RECT, 's'), { x: 0.4, y: 0.4 });
    expectPoint(handlePoint(RECT, 'sw'), { x: 0.2, y: 0.4 });
    expectPoint(handlePoint(RECT, 'w'), { x: 0.2, y: 0.3 });
  });
});

describe('resizeRect', () => {
  it('东/南手柄只改尺寸，西/北手柄同时移动原点', () => {
    expectRect(resizeRect(RECT, 'e', 0.1, 0), { x: 0.2, y: 0.2, w: 0.5, h: 0.2 });
    expectRect(resizeRect(RECT, 'w', 0.1, 0), { x: 0.3, y: 0.2, w: 0.3, h: 0.2 });
    expectRect(resizeRect(RECT, 's', 0, 0.1), { x: 0.2, y: 0.2, w: 0.4, h: 0.3 });
    expectRect(resizeRect(RECT, 'n', 0, 0.05), { x: 0.2, y: 0.25, w: 0.4, h: 0.15 });
  });

  it('对面边不会被越过：最小尺寸兜底', () => {
    const shrunk = resizeRect(RECT, 'e', -10, 0);
    expect(shrunk.w).toBeCloseTo(0.01, 10);
    expect(shrunk.x).toBeCloseTo(0.2, 10);

    const fromWest = resizeRect(RECT, 'w', 10, 0);
    expect(fromWest.x).toBeCloseTo(0.59, 10);
    expect(fromWest.w).toBeCloseTo(0.01, 10);
  });

  it('不越出页面', () => {
    const wide = resizeRect(RECT, 'e', 10, 0);
    expect(wide.x + wide.w).toBeCloseTo(1, 10);

    const tall = resizeRect(RECT, 'n', 0, -10);
    expect(tall.y).toBeCloseTo(0, 10);
    expect(tall.y + tall.h).toBeCloseTo(0.4, 10);
  });

  it('preserveAspect 只在角点生效，按主导轴等比', () => {
    // ratio 0.4 / 0.2 = 2, so the height follows the widened width
    expectRect(resizeRect(RECT, 'se', 0.1, 0, { preserveAspect: true }), {
      x: 0.2,
      y: 0.2,
      w: 0.5,
      h: 0.25,
    });

    expectRect(resizeRect(RECT, 'e', 0.1, 0, { preserveAspect: true }), {
      x: 0.2,
      y: 0.2,
      w: 0.5,
      h: 0.2,
    });
  });
});

describe('angleFromCenter', () => {
  const center = { x: 0.5, y: 0.5 };

  it('0° 指向上方，顺时针递增', () => {
    expect(angleFromCenter(center, { x: 0.5, y: 0.4 })).toBeCloseTo(0, 10);
    expect(angleFromCenter(center, { x: 0.6, y: 0.5 })).toBeCloseTo(90, 10);
    expect(angleFromCenter(center, { x: 0.5, y: 0.6 })).toBeCloseTo(180, 10);
    expect(angleFromCenter(center, { x: 0.4, y: 0.5 })).toBeCloseTo(270, 10);
  });

  it('pageAspect 修正非正方形页面的角度', () => {
    // Square page: the point sits at 45°; on a page twice as tall it is steeper
    expect(angleFromCenter(center, { x: 0.6, y: 0.4 }, 1)).toBeCloseTo(45, 6);
    expect(angleFromCenter(center, { x: 0.6, y: 0.4 }, 0.5)).toBeCloseTo(26.57, 1);
  });
});

describe('snapAngle', () => {
  it('吸附到 15° 网格并归一到 [0, 360)', () => {
    expect(snapAngle(7)).toBe(0);
    expect(snapAngle(8)).toBe(15);
    expect(snapAngle(52)).toBe(45);
    expect(snapAngle(352)).toBe(345);
    expect(snapAngle(-10)).toBe(345);
  });
});

describe('rotateDelta', () => {
  it('未旋转时原样返回', () => {
    const delta = rotateDelta(0.1, 0.2, 0);
    expect(delta.dx).toBeCloseTo(0.1, 10);
    expect(delta.dy).toBeCloseTo(0.2, 10);
  });

  it('90° 时把世界位移旋回对象本地坐标系', () => {
    const rotated = rotateDelta(0.1, 0, 90, 1);
    expect(rotated.dx).toBeCloseTo(0, 10);
    expect(rotated.dy).toBeCloseTo(-0.1, 10);
  });

  it('非正方形页面按像素换算后再旋转', () => {
    const rotated = rotateDelta(0.1, 0, 90, 2);
    expect(rotated.dx).toBeCloseTo(0, 10);
    expect(rotated.dy).toBeCloseTo(-0.2, 10);
  });
});
