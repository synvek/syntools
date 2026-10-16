import { describe, expect, it } from 'vitest';
import {
  VIEW_ROTATION_STEP,
  clampViewport,
  computeFitScale,
  docToScreen,
  normalizeViewRotation,
  rotatedDocBounds,
  screenToDoc,
  stagePosition,
  zoomAtPoint,
} from './core';

/**
 * 旋转视图的坐标换算测试。
 *
 * 旋转视图的成败全在「屏幕 ↔ 文档」两个方向的互逆性上：任何一处漏加旋转，
 * 表现都是「点击位置随角度偏移」这种致命但不易察觉的缺陷，因此这里把
 * **往返一致**与**零角度退化为旧行为**两条契约固定下来。
 */

const size = { width: 800, height: 600 };
const viewport = { scale: 0.5, x: 120, y: 90 };

describe('normalizeViewRotation', () => {
  it('归一化到 (-180, 180]', () => {
    expect(normalizeViewRotation(0)).toBe(0);
    expect(normalizeViewRotation(370)).toBe(10);
    expect(normalizeViewRotation(-190)).toBe(170);
    expect(normalizeViewRotation(180)).toBe(180);
    expect(normalizeViewRotation(540)).toBe(180);
    expect(normalizeViewRotation(-180)).toBe(180);
  });

  it('非法值回落 0，并保留两位小数', () => {
    expect(normalizeViewRotation(Number.NaN)).toBe(0);
    expect(normalizeViewRotation(11.23456)).toBe(11.23);
  });

  it('步进常量与菜单一致', () => {
    expect(VIEW_ROTATION_STEP).toBe(15);
  });
});

describe('rotatedDocBounds：旋转后的外接框', () => {
  it('零角度就是原尺寸', () => {
    expect(rotatedDocBounds({ width: 800, height: 600 }, 0)).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('90° 时长宽互换', () => {
    const bounds = rotatedDocBounds({ width: 800, height: 600 }, 90);
    expect(bounds.width).toBeCloseTo(600, 6);
    expect(bounds.height).toBeCloseTo(800, 6);
  });

  it('45° 时按 π/4 的三角值放大', () => {
    const bounds = rotatedDocBounds({ width: 100, height: 100 }, 45);
    expect(bounds.width).toBeCloseTo(100 * Math.SQRT2, 6);
  });
});

describe('docToScreen / screenToDoc：互为逆运算', () => {
  it('零旋转退化为旧行为（保证既有交互与 e2e 不受影响）', () => {
    const screen = docToScreen({ x: 200, y: 100 }, viewport, size, 0);
    expect(screen).toEqual({ x: 120 + 200 * 0.5, y: 90 + 100 * 0.5 });
    expect(screenToDoc({ x: 220, y: 140 }, viewport, size, 0)).toEqual({ x: 200, y: 100 });
  });

  it('任意角度下往返一致', () => {
    for (const rotation of [-165, -90, -30, 15, 45, 90, 135, 180]) {
      for (const point of [
        { x: 0, y: 0 },
        { x: 800, y: 600 },
        { x: 123, y: 456 },
      ]) {
        const screen = docToScreen(point, viewport, size, rotation);
        const back = screenToDoc(screen, viewport, size, rotation);
        expect(back.x).toBeCloseTo(point.x, 6);
        expect(back.y).toBeCloseTo(point.y, 6);
      }
    }
  });

  it('视口中心对应的文档点在任意角度下都不变', () => {
    const center = { x: size.width / 2, y: size.height / 2 };
    const zero = screenToDoc(center, viewport, size, 0);
    for (const rotation of [-90, 30, 120]) {
      const rotated = screenToDoc(center, viewport, size, rotation);
      expect(rotated.x).toBeCloseTo(zero.x, 6);
      expect(rotated.y).toBeCloseTo(zero.y, 6);
    }
  });

  it('90° 时文档 x 轴映射到屏幕 y 轴方向', () => {
    const origin = docToScreen({ x: 0, y: 0 }, viewport, size, 90);
    const along = docToScreen({ x: 100, y: 0 }, viewport, size, 90);
    // 顺时针 90°：文档 +x 变成屏幕 +y
    expect(along.x).toBeCloseTo(origin.x, 6);
    expect(along.y).toBeCloseTo(origin.y + 50, 6);
  });
});

describe('stagePosition：Konva 图层位置', () => {
  it('零角度直接等于视口平移量', () => {
    expect(stagePosition({ x: 120, y: 90 }, size, 0)).toEqual({ x: 120, y: 90 });
  });

  it('旋转围绕视口中心，且中心点是不动点', () => {
    const center = { x: size.width / 2, y: size.height / 2 };
    const positioned = stagePosition(center, size, 90);
    expect(positioned.x).toBeCloseTo(center.x, 6);
    expect(positioned.y).toBeCloseTo(center.y, 6);
  });

  it('与 docToScreen 一致：文档原点落在同一处', () => {
    for (const rotation of [-45, 30, 90]) {
      const positioned = stagePosition(viewport, size, rotation);
      const viaStage = { x: positioned.x + 0 * viewport.scale, y: positioned.y };
      const viaScreen = docToScreen({ x: 0, y: 0 }, viewport, size, rotation);
      expect(viaStage.x).toBeCloseTo(viaScreen.x, 6);
      expect(viaStage.y).toBeCloseTo(viaScreen.y, 6);
    }
  });
});

describe('computeFitScale：按外接框适配', () => {
  const doc = { width: 800, height: 600 };

  it('零角度与旧行为一致', () => {
    expect(computeFitScale(doc, { width: 1000, height: 700 }, 32, 0)).toBe(
      computeFitScale(doc, { width: 1000, height: 700 }, 32),
    );
  });

  it('90° 时按互换后的外接框算，比例更小', () => {
    const size420 = { width: 420, height: 320 };
    const upright = computeFitScale(doc, size420, 32, 0);
    const rotated = computeFitScale(doc, size420, 32, 90);
    expect(rotated).toBeLessThan(upright);
    // 90° 后外接框变成 600×800：纵向 (320-64)/800 = 0.32 才是瓶颈
    expect(rotated).toBeCloseTo(Math.round(((320 - 64) / 800) * 1000) / 1000, 6);
  });
});

describe('zoomAtPoint：旋转下保持锚点不动', () => {
  it('任意角度缩放后，锚点下的文档坐标不变', () => {
    const anchor = { x: 500, y: 300 };
    for (const rotation of [-60, 0, 45, 90]) {
      const before = screenToDoc(anchor, viewport, size, rotation);
      const next = zoomAtPoint(viewport, 1.25, anchor, size, rotation);
      const after = screenToDoc(anchor, { ...viewport, ...next }, size, rotation);
      // 视口平移量取整以保持像素锐利，因此允许亚像素级误差（约 0.08 文档单位）
      expect(Math.abs(after.x - before.x)).toBeLessThan(1);
      expect(Math.abs(after.y - before.y)).toBeLessThan(1);
    }
  });

  it('未传尺寸时退化为旧的线性换算', () => {
    const next = zoomAtPoint(viewport, 1, { x: 220, y: 140 });
    expect(next).toEqual({ scale: 1, x: Math.round(220 - 200 * 1), y: Math.round(140 - 100 * 1) });
  });
});

describe('clampViewport：旋转后仍可滚动到画布各角', () => {
  const doc = { width: 800, height: 600 };

  it('零角度与旧行为一致', () => {
    const next = clampViewport({ x: 99999, y: -99999, scale: 1 }, doc, size, undefined, 0);
    expect(next).toEqual(clampViewport({ x: 99999, y: -99999, scale: 1 }, doc, size));
  });

  it('旋转时滚动范围按外接框扩张（否则画布被锁死）', () => {
    const rotated = clampViewport({ x: 99999, y: -99999, scale: 1 }, doc, size, undefined, 45);
    const upright = clampViewport({ x: 99999, y: -99999, scale: 1 }, doc, size, undefined, 0);
    expect(Math.abs(rotated.x)).toBeGreaterThanOrEqual(Math.abs(upright.x));
    expect(Number.isFinite(rotated.x) && Number.isFinite(rotated.y)).toBe(true);
  });
});
