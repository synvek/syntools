import { describe, expect, it } from 'vitest';
import { createShapeObject } from '../model/objects';
import type { NormRect } from '../model/types';
import { hitTest, objectsInRect, pointInObject, rectsIntersect } from './hitTest';

const PAGE = 'page-main-0';

/** Wide box: 40% × 20% of the page, centered at (0.5, 0.5) */
const WIDE: NormRect = { x: 0.3, y: 0.4, w: 0.4, h: 0.2 };

function shape(rotation: number, id: string, rect: NormRect = WIDE, z = 1) {
  return createShapeObject({ page: PAGE, rect, type: 'rect', rotation, id, z });
}

describe('pointInObject', () => {
  it('未旋转：按矩形边界判定，边界点算命中', () => {
    const object = shape(0, 'plain');

    expect(pointInObject({ x: 0.5, y: 0.5 }, object)).toBe(true);
    expect(pointInObject({ x: 0.7, y: 0.5 }, object)).toBe(true);
    expect(pointInObject({ x: 0.71, y: 0.5 }, object)).toBe(false);
    expect(pointInObject({ x: 0.5, y: 0.6 }, object)).toBe(true);
    expect(pointInObject({ x: 0.5, y: 0.61 }, object)).toBe(false);
  });

  it('90° / 270° 交换长短轴', () => {
    const ninety = shape(90, 'ninety');
    expect(pointInObject({ x: 0.5, y: 0.69 }, ninety)).toBe(true);
    expect(pointInObject({ x: 0.5, y: 0.71 }, ninety)).toBe(false);
    expect(pointInObject({ x: 0.71, y: 0.5 }, ninety)).toBe(false);

    const twoSeventy = shape(270, 'two-seventy');
    expect(pointInObject({ x: 0.5, y: 0.31 }, twoSeventy)).toBe(true);
    expect(pointInObject({ x: 0.5, y: 0.29 }, twoSeventy)).toBe(false);
    expect(pointInObject({ x: 0.71, y: 0.5 }, twoSeventy)).toBe(false);
  });

  it('180° 与 0° 的命中区域一致', () => {
    const flipped = shape(180, 'flipped');

    expect(pointInObject({ x: 0.31, y: 0.5 }, flipped)).toBe(true);
    expect(pointInObject({ x: 0.5, y: 0.39 }, flipped)).toBe(false);
    expect(pointInObject({ x: 0.5, y: 0.41 }, flipped)).toBe(true);
  });

  it('45° 时外接框的角落不算命中', () => {
    const tilted = shape(45, 'tilted');

    expect(pointInObject({ x: 0.5, y: 0.5 }, tilted)).toBe(true);
    expect(pointInObject({ x: 0.69, y: 0.69 }, tilted)).toBe(false);
  });

  it('pageAspect 让旋转后的判定按真实像素比例', () => {
    const ninety = shape(90, 'aspect');
    // Tall page (width / height = 0.5): the 40%×20% box is 120×120 px, so after the 90° turn it
    // spans 0.2 of the width and only 0.1 of the height
    expect(pointInObject({ x: 0.5, y: 0.65 }, ninety, 0.5)).toBe(false);
    expect(pointInObject({ x: 0.68, y: 0.5 }, ninety, 0.5)).toBe(true);
    // The same points behave the other way round on a square page
    expect(pointInObject({ x: 0.5, y: 0.65 }, ninety, 1)).toBe(true);
    expect(pointInObject({ x: 0.68, y: 0.5 }, ninety, 1)).toBe(false);
  });
});

describe('hitTest', () => {
  it('取 z 最高的对象，与数组顺序无关', () => {
    const bottom = shape(0, 'bottom', WIDE, 1);
    const top = shape(0, 'top', WIDE, 5);

    expect(hitTest({ x: 0.5, y: 0.5 }, [bottom, top])?.id).toBe('top');
    expect(hitTest({ x: 0.5, y: 0.5 }, [top, bottom])?.id).toBe('top');
  });

  it('没有对象命中时返回 null', () => {
    expect(hitTest({ x: 0.05, y: 0.05 }, [shape(0, 'bottom')])).toBeNull();
  });

  it('z 相同时取后绘制的对象（绘制顺序在后者更靠上）', () => {
    const first = shape(0, 'first', WIDE, 2);
    const second = shape(0, 'second', WIDE, 2);

    expect(hitTest({ x: 0.5, y: 0.5 }, [first, second])?.id).toBe('second');
  });
});

describe('objectsInRect / rectsIntersect', () => {
  it('只取与框相交的对象，并按 z 降序返回', () => {
    const left = shape(0, 'left', { x: 0.05, y: 0.05, w: 0.1, h: 0.1 }, 1);
    const big = shape(0, 'big', WIDE, 3);
    const small = shape(0, 'small', { x: 0.3, y: 0.4, w: 0.1, h: 0.1 }, 2);

    const hits = objectsInRect({ x: 0.3, y: 0.4, w: 0.2, h: 0.1 }, [left, big, small]);
    expect(hits.map((object) => object.id)).toEqual(['big', 'small']);
  });

  it('仅边缘相接不算相交', () => {
    expect(rectsIntersect({ x: 0, y: 0, w: 0.2, h: 0.2 }, { x: 0.2, y: 0, w: 0.2, h: 0.2 })).toBe(
      false,
    );
    expect(rectsIntersect({ x: 0, y: 0, w: 0.2, h: 0.2 }, { x: 0.19, y: 0, w: 0.2, h: 0.2 })).toBe(
      true,
    );
  });

  it('空对象列表返回空数组', () => {
    expect(objectsInRect({ x: 0, y: 0, w: 1, h: 1 }, [])).toEqual([]);
  });
});
