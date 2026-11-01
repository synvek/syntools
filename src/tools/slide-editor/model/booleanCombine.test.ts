import { describe, expect, it } from 'vitest';
import { polygonArea } from '../../../core/drawing/boolean';
import type { PathCommand } from '../../../core/drawing/geometry';
import { combineShapes, shapeOutlines } from './booleanCombine';
import { createDoc, createShapeElement } from './factory';
import type { ShapeElement } from './types';

/**
 * Boolean combine (P2-S5): presets are flattened into absolute outlines, the kernel merges them,
 * and the result comes back as one `custGeom` shape with normalized commands.
 */

const doc = createDoc('boolean');

function rect(x: number, y: number, width: number, height: number): ShapeElement {
  const element = createShapeElement(doc, { kind: 'rect', prst: 'rect' });
  element.x = x;
  element.y = y;
  element.width = width;
  element.height = height;
  return element as ShapeElement;
}

function area(commands: PathCommand[]): number {
  // Absolute area per contour: a hole has the opposite winding, and sign-cancelling it would hide
  // the real footprint (exclude/xor returns overlapping regions as separate rings)
  const contours: number[][] = [];
  let ring: number[] = [];
  for (const command of commands) {
    if (command.c === 'M' || command.c === 'L') ring.push(command.x, command.y);
    else if (command.c === 'Z') {
      contours.push(ring);
      ring = [];
    }
  }
  if (ring.length >= 6) contours.push(ring);
  return contours.reduce((sum, flat) => sum + polygonArea(flat), 0);
}

function ringCount(commands: PathCommand[]): number {
  return commands.filter((command) => command.c === 'M').length;
}

describe('shapeOutlines', () => {
  it('把矩形展开成绝对坐标的闭合轮廓', () => {
    expect(shapeOutlines(rect(10, 20, 100, 50))).toEqual([[10, 20, 110, 20, 110, 70, 10, 70]]);
  });

  it('椭圆与多边形按元素盒缩放', () => {
    const ellipse = createShapeElement(doc, { kind: 'ellipse', prst: 'ellipse' }) as ShapeElement;
    ellipse.x = 0;
    ellipse.y = 0;
    ellipse.width = 100;
    ellipse.height = 100;
    const [ring] = shapeOutlines(ellipse);
    // 48 段内接多边形：面积略小于 πr²（误差 < 1%），顶点都落在盒内
    expect(ring.length).toBeGreaterThanOrEqual(6);
    expect(polygonArea(ring) / (Math.PI * 50 * 50)).toBeGreaterThan(0.99);

    const triangle = createShapeElement(doc, {
      kind: 'polygon',
      prst: 'triangle',
      points: [0.5, 0, 1, 1, 0, 1],
    }) as ShapeElement;
    triangle.x = 0;
    triangle.y = 0;
    triangle.width = 100;
    triangle.height = 100;
    expect(shapeOutlines(triangle)).toEqual([[50, 0, 100, 100, 0, 100]]);
  });

  it('legacy SVG 路径按真实轮廓展开，而不是外接盒', () => {
    const pathShape = createShapeElement(doc, {
      kind: 'path',
      prst: 'triangle',
      path: 'M0 0 L1 0 L1 1 Z',
    }) as ShapeElement;
    pathShape.x = 0;
    pathShape.y = 0;
    pathShape.width = 100;
    pathShape.height = 100;
    // The closing vertex is repeated so the clipper sees a closed ring
    expect(shapeOutlines(pathShape)).toEqual([[0, 0, 100, 0, 100, 100, 0, 0]]);
  });
});

describe('combineShapes', () => {
  it('并集取两个形状的外接盒并保留首个形状的样式', async () => {
    const first = rect(10, 10, 50, 40);
    first.rotation = 45;
    first.flipX = true;
    const second = rect(30, 30, 50, 40);

    const result = await combineShapes('union', [first, second]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const element = result.element;
    expect(element).toMatchObject({
      type: 'shape',
      x: 10,
      y: 10,
      width: 70,
      height: 60,
      // Rotation / flip never entered the math, so the result must not claim them
      rotation: 0,
      flipX: false,
      flipY: false,
      fill: first.fill,
      stroke: first.stroke,
    });
    expect(element.id).not.toBe(first.id);
    expect(element.geom.kind).toBe('path');
    // Two overlapping 50×40 boxes: 2000 + 2000 − 30×20
    expect(area(element.geom.custGeom ?? []) * element.width * element.height).toBeCloseTo(3400, 0);
  });

  it('相减以首个形状为主体（与 PowerPoint 的口径一致）', async () => {
    const subject = rect(10, 10, 50, 40);
    const clipper = rect(30, 30, 50, 40);

    const result = await combineShapes('subtract', [subject, clipper]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Subject minus the overlap: 2000 − 600, still inside the subject box
    expect(result.element).toMatchObject({ x: 10, y: 10, width: 50, height: 40 });
    const pixels =
      area(result.element.geom.custGeom ?? []) * result.element.width * result.element.height;
    expect(pixels).toBeCloseTo(1400, 0);
    // An L-shape needs more than the 4 corners of the original box
    expect(result.element.geom.custGeom?.length).toBeGreaterThan(5);

    // Cutting away everything yields nothing to insert
    const gone = await combineShapes('subtract', [subject, rect(0, 0, 400, 400)]);
    expect(gone).toEqual({ ok: false, reason: 'empty-result' });
  });

  it('相交只留重叠区域，不相交时返回空结果', async () => {
    const result = await combineShapes('intersect', [rect(10, 10, 50, 40), rect(30, 30, 50, 40)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.element).toMatchObject({ x: 30, y: 30, width: 30, height: 20 });

    const disjoint = await combineShapes('intersect', [rect(0, 0, 10, 10), rect(100, 100, 10, 10)]);
    expect(disjoint).toEqual({ ok: false, reason: 'empty-result' });
  });

  it('排除得到两片区域（重叠部分被挖掉）', async () => {
    const result = await combineShapes('exclude', [rect(10, 10, 50, 40), rect(30, 30, 50, 40)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(ringCount(result.element.geom.custGeom ?? [])).toBeGreaterThanOrEqual(2);
    const pixels =
      area(result.element.geom.custGeom ?? []) * result.element.width * result.element.height;
    // 2000 + 2000 − 2 × 600
    expect(pixels).toBeCloseTo(2800, 0);
  });

  it('custGeom 归一化到单位盒内', async () => {
    const result = await combineShapes('union', [rect(10, 10, 50, 40), rect(30, 30, 50, 40)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const command of result.element.geom.custGeom ?? []) {
      if (command.c === 'Z') continue;
      expect(command.x).toBeGreaterThanOrEqual(0);
      expect(command.x).toBeLessThanOrEqual(1);
      expect(command.y).toBeGreaterThanOrEqual(0);
      expect(command.y).toBeLessThanOrEqual(1);
    }
  });

  it('轮廓不足两个时明确失败，不抛异常', async () => {
    expect(await combineShapes('union', [rect(0, 0, 10, 10)])).toEqual({
      ok: false,
      reason: 'unsupported-geometry',
    });
  });
});
