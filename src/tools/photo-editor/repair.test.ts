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
 * Pure-logic tests for the retouch / repair family.
 *
 * Stamp stepping, edge falloff, color matching and box blur are all pure functions that can be asserted directly;
 * actual pixel I/O needs Canvas2D (absent in jsdom) and is therefore out of unit-test scope.
 */

describe('Tool family constants', () => {
  it('the repair family has 6 tools', () => {
    expect(REPAIR_TOOLS).toHaveLength(6);
    expect(REPAIR_TOOLS).toContain('cloneStamp');
    expect(REPAIR_TOOLS).toContain('sharpenBrush');
  });

  it('only the clone stamp and healing brush need a manual sample', () => {
    expect(needsCloneSource('cloneStamp')).toBe(true);
    expect(needsCloneSource('healing')).toBe(true);
    expect(needsCloneSource('spotHeal')).toBe(false);
    expect(needsCloneSource('smudge')).toBe(false);
    expect(needsCloneSource('blurBrush')).toBe(false);
    expect(needsCloneSource('brush')).toBe(false);
  });

  it('repair tools space stamps tighter than dodge / burn (they must be continuous)', () => {
    expect(REPAIR_SPACING).toBeLessThan(0.25);
    expect(REPAIR_SPACING).toBeGreaterThan(0);
  });
});

describe('walkStamps: stamp stepping', () => {
  it('no stamp is produced for zero movement', () => {
    expect(walkStamps(10, 10, 10, 10, 5, 5).positions).toEqual([]);
  });

  it('interpolates at even steps and carries the remainder across calls', () => {
    const step = walkStamps(0, 0, 10, 0, 5, 5);
    expect(step.positions).toEqual([
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ]);
    // The last stamp lands exactly on the endpoint: a full step is still needed before the next one
    expect(step.next).toBe(5);

    // The remainder keeps counting: from 10 to 12, 5 more units before the next stamp
    const more = walkStamps(10, 0, 12, 0, 5, step.next);
    expect(more.positions).toEqual([]);
    expect(more.next).toBe(3);
  });

  it('diagonal movement steps by true distance (not by coordinate component)', () => {
    // 3-4-5 right triangle: moving (3,4) covers 5 pixels
    const result = walkStamps(0, 0, 3, 4, 5, 5);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].x).toBeCloseTo(3, 6);
    expect(result.positions[0].y).toBeCloseTo(4, 6);
  });

  it('extreme jumps are capped', () => {
    const result = walkStamps(0, 0, 1, 0, 1 / MAX_STAMPS_PER_MOVE, 1 / MAX_STAMPS_PER_MOVE);
    expect(result.positions.length).toBeLessThanOrEqual(MAX_STAMPS_PER_MOVE);
  });
});

describe('stampFalloff: edge falloff', () => {
  it('1 at the center, 0 at the edge, 0 outside the circle', () => {
    expect(stampFalloff(0)).toBe(1);
    expect(stampFalloff(1)).toBe(0);
    expect(stampFalloff(1.2)).toBe(0);
  });

  it('decreases monotonically', () => {
    let previous = stampFalloff(0);
    for (let distance = 0.1; distance <= 1; distance += 0.1) {
      const value = stampFalloff(distance);
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('healOffset / mixChannel: pixel math', () => {
  it('heal offset = target mean minus source mean', () => {
    expect(healOffset([10, 20, 30], [12, 25, 27])).toEqual([2, 5, -3]);
  });

  it('missing components count as 0 and never propagate NaN', () => {
    expect(healOffset([], [3, 4, 5])).toEqual([3, 4, 5]);
  });

  it('mixChannel blends linearly by weight and clamps', () => {
    expect(mixChannel(0, 100, 0.5)).toBe(50);
    expect(mixChannel(0, 100, 0)).toBe(0);
    expect(mixChannel(0, 100, 1)).toBe(100);
    expect(mixChannel(0, 100, 5)).toBe(100);
    expect(mixChannel(0, 100, Number.NaN)).toBe(0);
  });
});

describe('boxBlurRgba: separable box blur', () => {
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

  it('a uniform image is unchanged by blurring', () => {
    const data = make(4, 4, [120, 60, 30]);
    const out = boxBlurRgba(data, 4, 4, 1);
    expect([...out.slice(0, 4)]).toEqual([120, 60, 30, 255]);
  });

  it('a single bright dot spreads into its neighborhood (the peak drops)', () => {
    const data = make(5, 5, [0, 0, 0]);
    data[(2 * 5 + 2) * 4] = 255;
    const out = boxBlurRgba(data, 5, 5, 1);
    expect(out[(2 * 5 + 2) * 4]).toBeLessThan(255);
    expect(out[(2 * 5 + 2) * 4]).toBeGreaterThan(0);
    // The neighborhood received energy too
    expect(out[(2 * 5 + 1) * 4]).toBeGreaterThan(0);
  });

  it('alpha is blurred too (semi-transparent edges do not harden)', () => {
    const data = new Uint8ClampedArray(3 * 1 * 4);
    data[0 * 4 + 3] = 255;
    const out = boxBlurRgba(data, 3, 1, 1);
    expect(out[1 * 4 + 3]).toBeGreaterThan(0);
    expect(out[1 * 4 + 3]).toBeLessThan(255);
  });

  it('size 1 or an out-of-range radius never crashes (real edge-stamp cases)', () => {
    const single = new Uint8ClampedArray([10, 20, 30, 255]);
    expect([...boxBlurRgba(single, 1, 1, 1)]).toEqual([10, 20, 30, 255]);
    const strip = make(1, 3, [200, 100, 50]);
    expect([...boxBlurRgba(strip, 1, 3, 2).slice(0, 4)]).toEqual([200, 100, 50, 255]);
  });
});
