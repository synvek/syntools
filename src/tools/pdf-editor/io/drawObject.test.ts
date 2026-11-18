import { describe, expect, it } from 'vitest';
import { createInkObject, createMarkupObject, createShapeObject } from '../model/objects';
import {
  arrowHeadPoints,
  inkPolyline,
  lineEndpoints,
  markupQuadRects,
  objectFrame,
} from './drawObject';

const PAGE = 'page-main-0';
/** A4-ish visual page in points */
const VISUAL = { width: 600, height: 800 };

describe('objectFrame', () => {
  it('把归一化矩形换算成左下原点的点坐标', () => {
    const shape = createShapeObject({
      page: PAGE,
      rect: { x: 0.25, y: 0.25, w: 0.5, h: 0.25 },
      type: 'rect',
      id: 'shape',
    });

    const frame = objectFrame(shape, VISUAL);
    expect(frame.x).toBeCloseTo(150, 6);
    expect(frame.y).toBeCloseTo(400, 6);
    expect(frame.width).toBeCloseTo(300, 6);
    expect(frame.height).toBeCloseTo(200, 6);
  });
});

describe('markupQuadRects', () => {
  it('每个 quad 单独换算', () => {
    const markup = createMarkupObject({
      page: PAGE,
      type: 'highlight',
      rect: { x: 0.25, y: 0.25, w: 0.5, h: 0.1 },
      quads: [
        { x: 0.25, y: 0.25, w: 0.5, h: 0.1 },
        { x: 0.1, y: 0.6, w: 0.2, h: 0.05 },
      ],
      id: 'markup',
    });

    const [first, second] = markupQuadRects(markup, VISUAL);
    expect([first.x, first.y, first.width, first.height].map((value) => Math.round(value))).toEqual(
      [150, 520, 300, 80],
    );
    expect([
      Math.round(second.x),
      Math.round(second.y),
      Math.round(second.width),
      Math.round(second.height),
    ]).toEqual([60, 280, 120, 40]);
  });
});

describe('inkPolyline', () => {
  it('点相对矩形归一化、y 轴翻到 PDF 方向', () => {
    const ink = createInkObject({
      page: PAGE,
      rect: { x: 0.5, y: 0.5, w: 0.2, h: 0.2 },
      points: [
        { x: 0.5, y: 0.5 },
        { x: 0.7, y: 0.7 },
      ],
      id: 'ink',
    });

    const [first, second] = inkPolyline(ink, VISUAL);
    expect(first.x).toBeCloseTo(300, 6);
    expect(first.y).toBeCloseTo(400, 6);
    expect(second.x).toBeCloseTo(420, 6);
    expect(second.y).toBeCloseTo(240, 6);
  });
});

describe('arrowHeadPoints', () => {
  it('两条翼在终点后方对称展开', () => {
    const [left, right] = arrowHeadPoints({ x: 0, y: 0 }, { x: 10, y: 0 }, 2);

    expect(left.x).toBeCloseTo(2.79, 2);
    expect(left.y).toBeCloseTo(3.47, 2);
    expect(right.x).toBeCloseTo(2.79, 2);
    expect(right.y).toBeCloseTo(-3.47, 2);
  });

  it('线越粗箭头越大', () => {
    const [thin] = arrowHeadPoints({ x: 0, y: 0 }, { x: 0, y: 100 }, 0.5);
    const [thick] = arrowHeadPoints({ x: 0, y: 0 }, { x: 0, y: 100 }, 3);

    // 沿 -y 前进时翼在下方：细线的翼离终点更近
    expect(Math.hypot(100 - thin.y, thin.x)).toBeLessThan(Math.hypot(100 - thick.y, thick.x));
  });
});

describe('lineEndpoints', () => {
  it('左上 → 右下，和 SVG 预览一致', () => {
    expect(lineEndpoints({ x: 10, y: 20, width: 100, height: 50 })).toEqual({
      start: { x: 10, y: 70 },
      end: { x: 110, y: 20 },
    });
  });
});
