import { describe, expect, it } from 'vitest';
import {
  invertSelection,
  pointInSelection,
  selectionBounds,
  selectionContours,
  shapePolygon,
  signedArea,
  orientPolygon,
  fullSelection,
} from './core';
import type { Selection } from './model/types';

const rect = (x: number, y: number, width: number, height: number): Selection => ({
  kind: 'rect',
  x,
  y,
  width,
  height,
  path: [],
  feather: 0,
});

describe('signedArea / orientPolygon', () => {
  it('detects polygon orientation', () => {
    const cw = [0, 0, 10, 0, 10, 10, 0, 10];
    const ccw = [0, 0, 0, 10, 10, 10, 10, 0];
    expect(signedArea(cw)).toBeGreaterThan(0);
    expect(signedArea(ccw)).toBeLessThan(0);
  });

  it('reverses a polygon whose orientation does not match the target', () => {
    const cw = [0, 0, 10, 0, 10, 10, 0, 10];
    expect(orientPolygon(cw, true)).toEqual(cw);
    const flipped = orientPolygon(cw, false);
    expect(signedArea(flipped)).toBeLessThan(0);
    expect(flipped.length).toBe(cw.length);
  });

  it('keeps degenerate polygons untouched', () => {
    expect(orientPolygon([0, 0, 1, 1], true)).toEqual([0, 0, 1, 1]);
  });
});

describe('shapePolygon', () => {
  it('converts a rect into its four corners', () => {
    expect(shapePolygon(rect(10, 20, 30, 40))).toEqual([10, 20, 40, 20, 40, 60, 10, 60]);
  });

  it('samples an ellipse into many points', () => {
    const polygon = shapePolygon({ ...rect(0, 0, 100, 50), kind: 'ellipse' });
    expect(polygon.length).toBe(96);
  });

  it('returns the lasso path as-is', () => {
    const selection: Selection = { ...rect(0, 0, 10, 10), kind: 'lasso', path: [0, 0, 5, 0, 5, 5] };
    expect(shapePolygon(selection)).toEqual([0, 0, 5, 0, 5, 5]);
  });
});

describe('selectionContours', () => {
  it('produces one union contour for a plain shape', () => {
    const contours = selectionContours(rect(0, 0, 10, 10));
    expect(contours).toHaveLength(1);
    expect(contours[0].add).toBe(true);
  });

  it('marks the hole as a subtraction and keeps appended parts with their flags', () => {
    const selection: Selection = {
      kind: 'lasso',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      path: [0, 0, 100, 0, 100, 100, 0, 100],
      hole: [20, 20, 40, 20, 40, 40, 20, 40],
      parts: [
        { path: [60, 60, 80, 60, 80, 80, 60, 80], add: true },
        { path: [0, 0, 5, 0, 5, 5, 0, 5], add: false },
      ],
      feather: 0,
    };
    const contours = selectionContours(selection);
    expect(contours.map((c) => c.add)).toEqual([true, false, true, false]);
  });
});

describe('pointInSelection', () => {
  it('hits inside a rect and misses outside', () => {
    expect(pointInSelection(rect(10, 10, 50, 50), 30, 30)).toBe(true);
    expect(pointInSelection(rect(10, 10, 50, 50), 5, 5)).toBe(false);
  });

  it('excludes holes (inverted selection)', () => {
    const inverted = invertSelection(rect(10, 10, 40, 40), { width: 100, height: 100 });
    expect(pointInSelection(inverted, 30, 30)).toBe(false);
    expect(pointInSelection(inverted, 80, 80)).toBe(true);
    expect(pointInSelection(inverted, 5, 5)).toBe(true);
  });

  it('unions added contours', () => {
    const base = rect(0, 0, 40, 40);
    const union: Selection = {
      ...base,
      parts: [{ path: shapePolygon(rect(60, 60, 40, 40)), add: true }],
    };
    expect(pointInSelection(union, 20, 20)).toBe(true);
    expect(pointInSelection(union, 80, 80)).toBe(true);
    expect(pointInSelection(union, 50, 50)).toBe(false);
  });

  it('removes subtracted contours', () => {
    const base = rect(0, 0, 100, 100);
    const cut: Selection = {
      ...base,
      parts: [{ path: shapePolygon(rect(40, 40, 20, 20)), add: false }],
    };
    expect(pointInSelection(cut, 50, 50)).toBe(false);
    expect(pointInSelection(cut, 10, 10)).toBe(true);
  });

  it('treats overlapping unions as a union, not an xor', () => {
    const base = rect(0, 0, 60, 60);
    const union: Selection = {
      ...base,
      parts: [{ path: shapePolygon(rect(40, 40, 60, 60)), add: true }],
    };
    // The overlap (40..60) must be hit
    expect(pointInSelection(union, 50, 50)).toBe(true);
  });

  it('ignores a selection with no geometry', () => {
    expect(pointInSelection(fullSelection({ width: 0, height: 0 }), 0, 0)).toBe(false);
  });
});

describe('selectionBounds', () => {
  it('unions the bounds of all contours', () => {
    const selection: Selection = {
      ...rect(0, 0, 20, 20),
      parts: [{ path: shapePolygon(rect(80, 80, 20, 20)), add: true }],
    };
    expect(selectionBounds(selection)).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });
});
