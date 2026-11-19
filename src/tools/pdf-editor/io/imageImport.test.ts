import { describe, expect, it } from 'vitest';
import { placeImageRect } from './imageImport';

const A4 = { width: 595.28, height: 841.89 };

describe('placeImageRect', () => {
  it('centres a landscape photo and caps its width at 45%', () => {
    const rect = placeImageRect({ width: 4000, height: 3000 }, A4);
    expect(rect.w).toBeCloseTo(0.45, 5);
    expect(rect.h).toBeCloseTo((0.45 * A4.width * 3000) / (4000 * A4.height), 5);
    expect(rect.x).toBeCloseTo((1 - rect.w) / 2, 5);
    expect(rect.y).toBeCloseTo((1 - rect.h) / 2, 5);
    expect(rect.h).toBeLessThanOrEqual(0.6);
  });

  it('caps a tall portrait image by height instead of overflowing the page', () => {
    const rect = placeImageRect({ width: 1000, height: 4000 }, A4);
    expect(rect.h).toBeCloseTo(0.6, 5);
    expect(rect.w).toBeCloseTo((0.6 * A4.height * 1000) / (4000 * A4.width), 5);
    expect(rect.w).toBeLessThan(0.45);
  });

  it('never exceeds the page when both caps are tight', () => {
    const rect = placeImageRect({ width: 10, height: 10 }, A4, { maxWidth: 1.4, maxHeight: 0.05 });
    expect(rect.h).toBeLessThanOrEqual(1);
    expect(rect.w).toBeLessThanOrEqual(1);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
  });

  it('keeps a square image square on a square page', () => {
    const rect = placeImageRect({ width: 800, height: 800 }, { width: 500, height: 500 });
    expect(rect.w).toBeCloseTo(rect.h, 10);
    expect(rect.w).toBeCloseTo(0.45, 5);
  });

  it('survives zero / negative natural sizes', () => {
    const rect = placeImageRect({ width: 0, height: 0 }, A4);
    expect(Number.isFinite(rect.w)).toBe(true);
    expect(Number.isFinite(rect.h)).toBe(true);
    expect(rect.w).toBeGreaterThan(0);
    expect(rect.h).toBeGreaterThan(0);
  });
});
