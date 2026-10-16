import { describe, expect, it } from 'vitest';
import {
  buildAdjustLuts,
  buildCurveLut,
  buildLevelsLut,
  composeLut,
  defaultBlackWhite,
  defaultCurves,
  defaultFilterParams,
  defaultLevels,
  filterParam,
} from './core';
import { createAdjustments } from './model/factory';

describe('buildLevelsLut', () => {
  it('is the identity for default levels', () => {
    const lut = buildLevelsLut(defaultLevels());
    for (let i = 0; i < 256; i += 1) expect(lut[i]).toBe(i);
  });

  it('crushes everything below the input black point', () => {
    const lut = buildLevelsLut({ ...defaultLevels(), inBlack: 128 });
    expect(lut[0]).toBe(0);
    expect(lut[128]).toBe(0);
    expect(lut[255]).toBe(255);
  });

  it('gamma above 1 brightens midtones', () => {
    const lut = buildLevelsLut({ ...defaultLevels(), gamma: 2 });
    expect(lut[128]).toBeGreaterThan(128);
  });

  it('remaps the output range', () => {
    const lut = buildLevelsLut({ ...defaultLevels(), outBlack: 50, outWhite: 200 });
    expect(lut[0]).toBe(50);
    expect(lut[255]).toBe(200);
  });
});

describe('buildCurveLut', () => {
  it('is the identity for an empty or two-point diagonal', () => {
    const fallback = buildCurveLut([]);
    for (let i = 0; i < 256; i += 1) expect(fallback[i]).toBe(i);
    const diagonal = buildCurveLut([
      { x: 0, y: 0 },
      { x: 255, y: 255 },
    ]);
    for (let i = 0; i < 256; i += 1) expect(diagonal[i]).toBe(i);
  });

  it('raises midtones without overshooting the control points', () => {
    const lut = buildCurveLut([
      { x: 0, y: 0 },
      { x: 128, y: 200 },
      { x: 255, y: 255 },
    ]);
    expect(lut[128]).toBe(200);
    // 单调性：PCHIP 不会在控制点间过冲
    for (let i = 1; i < 256; i += 1) expect(lut[i]).toBeGreaterThanOrEqual(lut[i - 1]);
  });

  it('flattens to a constant for a single control point', () => {
    const lut = buildCurveLut([{ x: 128, y: 30 }]);
    expect(lut[0]).toBe(30);
    expect(lut[255]).toBe(30);
  });

  it('sorts unsorted input before interpolating', () => {
    const lut = buildCurveLut([
      { x: 255, y: 255 },
      { x: 0, y: 0 },
    ]);
    expect(lut[128]).toBeGreaterThan(120);
  });
});

describe('composeLut', () => {
  it('applies the first table then the second', () => {
    const invert = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i += 1) invert[i] = 255 - i;
    const composed = composeLut(invert, invert);
    for (let i = 0; i < 256; i += 1) expect(composed[i]).toBe(i);
  });
});

describe('buildAdjustLuts', () => {
  it('returns null when no separable adjustment is enabled', () => {
    expect(buildAdjustLuts(createAdjustments())).toBeNull();
  });

  it('applies levels to every channel', () => {
    const luts = buildAdjustLuts({
      ...createAdjustments(),
      levels: { ...defaultLevels(), gamma: 2 },
    });
    expect(luts).not.toBeNull();
    expect(luts?.r[128]).toBe(luts?.g[128]);
    expect(luts?.g[128]).toBe(luts?.b[128]);
    expect(luts!.r[128]).toBeGreaterThan(128);
  });

  it('applies a per-channel curve only to that channel', () => {
    const luts = buildAdjustLuts({
      ...createAdjustments(),
      curves: {
        ...defaultCurves(),
        red: [
          { x: 0, y: 0 },
          { x: 128, y: 200 },
          { x: 255, y: 255 },
        ],
      },
    });
    expect(luts?.r[128]).toBe(200);
    expect(luts?.g[128]).toBe(128);
    expect(luts?.b[128]).toBe(128);
  });
});

describe('filter params', () => {
  it('exposes defaults for every declared parameter', () => {
    expect(defaultFilterParams('blur')).toEqual({ radius: 4 });
    expect(defaultFilterParams('posterize')).toEqual({ levels: 4 });
    expect(defaultFilterParams('grayscale')).toEqual({});
  });

  it('falls back to the default when a param is missing or invalid', () => {
    expect(filterParam({ id: 'blur' }, 'radius')).toBe(4);
    expect(filterParam({ id: 'blur', params: { radius: 12 } }, 'radius')).toBe(12);
    expect(filterParam({ id: 'blur', params: { radius: Number.NaN } }, 'radius')).toBe(4);
  });
});

describe('defaultBlackWhite', () => {
  it('ships usable weights', () => {
    const weights = defaultBlackWhite();
    expect(weights.red).toBeGreaterThan(0);
    expect(Object.keys(weights)).toHaveLength(6);
  });
});
