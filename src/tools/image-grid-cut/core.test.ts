import { describe, expect, it } from 'vitest';
import { computeGrid } from './core';

describe('image-grid-cut', () => {
  it('2×2 均分无间隔', () => {
    const r = computeGrid(100, 100, 2, 2, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(4);
    expect(r.value[0]).toEqual({ x: 0, y: 0, width: 50, height: 50, row: 0, col: 0 });
    expect(r.value[3]).toEqual({ x: 50, y: 50, width: 50, height: 50, row: 1, col: 1 });
  });

  it('含间隔时块尺寸减小', () => {
    const r = computeGrid(100, 100, 2, 2, 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value[0].width).toBe(45);
    expect(r.value[3].x).toBe(55);
  });

  it('3×1 横向切分', () => {
    const r = computeGrid(90, 30, 3, 1, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.map((c) => c.x)).toEqual([0, 30, 60]);
    expect(r.value.every((c) => c.height === 30)).toBe(true);
  });

  it('块数过多报错', () => {
    expect(computeGrid(10, 10, 50, 50, 0)).toEqual({ ok: false, error: 'TOO_MANY' });
  });

  it('非法尺寸报错', () => {
    expect(computeGrid(0, 100, 2, 2)).toEqual({ ok: false, error: 'EMPTY' });
  });
});
