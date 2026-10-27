import { describe, expect, it } from 'vitest';
import { FILTER_GROUPS, FILTER_PARAMS, FILTERS } from './core';
import {
  applyClouds,
  applyFindEdges,
  applyLensFlare,
  applyPinch,
  applyReduceNoise,
  applySpherize,
  applyTraceContour,
  applyTwirl,
  isExtraFilter,
  sampleBilinear,
} from './render/filterExtra';

/**
 * Pixel-level tests for the extra filters (distort / stylize / render / noise reduction).
 *
 * All of them are pure functions that rewrite the RGBA buffer in place, so they can be asserted directly under jsdom;
 * **uniform-color invariance** (a uniform image stays uniform after a geometric transform) is the most effective regression
 * guard for geometry filters: get the inverse mapping wrong and stripes or holes appear at once.
 */

const rgba = (pixels: number[][]): Uint8ClampedArray => Uint8ClampedArray.from(pixels.flat());

const flat = (width: number, height: number, color: number[]): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = color[0];
    data[index * 4 + 1] = color[1];
    data[index * 4 + 2] = color[2];
    data[index * 4 + 3] = 255;
  }
  return data;
};

/** Assert that the whole buffer has a single color (allowing 1 byte of interpolation error) */
const expectUniform = (data: Uint8ClampedArray, expected: number[]) => {
  for (let index = 0; index < data.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      expect(Math.abs(data[index + channel] - expected[channel])).toBeLessThanOrEqual(1);
    }
  }
};

const pixel = (data: Uint8ClampedArray, width: number, x: number, y: number) => {
  const offset = (y * width + x) * 4;
  return [data[offset], data[offset + 1], data[offset + 2]];
};

describe('Filter list and grouping consistency', () => {
  it('groups cover FILTERS completely with no duplicates', () => {
    const grouped = FILTER_GROUPS.flatMap((group) => group.items);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual([...FILTERS].sort());
  });

  it('every filter has a parameter spec (possibly empty)', () => {
    for (const id of FILTERS) expect(Array.isArray(FILTER_PARAMS[id])).toBe(true);
  });

  it('there are 8 extra filters and all need the pixel pipeline (CSS cannot express them)', () => {
    const extra = FILTERS.filter((id) => isExtraFilter(id));
    expect(extra).toEqual([
      'twirl',
      'spherize',
      'pinch',
      'findEdges',
      'traceContour',
      'clouds',
      'lensFlare',
      'reduceNoise',
    ]);
  });
});

describe('sampleBilinear', () => {
  it('integer coordinates sample the original pixel', () => {
    const data = rgba([
      [10, 20, 30, 255],
      [40, 50, 60, 255],
    ]);
    expect(sampleBilinear(data, 2, 1, 0, 0)).toEqual([10, 20, 30, 255]);
    expect(sampleBilinear(data, 2, 1, 1, 0)).toEqual([40, 50, 60, 255]);
  });

  it('a midpoint averages the two neighbouring pixels', () => {
    const data = rgba([
      [0, 0, 0, 255],
      [100, 100, 100, 255],
    ]);
    expect(sampleBilinear(data, 2, 1, 0.5, 0)).toEqual([50, 50, 50, 255]);
  });

  it('out-of-range samples clamp to the edge pixel (otherwise warping leaves transparent gaps)', () => {
    const data = flat(2, 2, [200, 200, 200]);
    expect(sampleBilinear(data, 2, 2, -5, 0)).toEqual([200, 200, 200, 255]);
    expect(sampleBilinear(data, 2, 2, 0, 9)).toEqual([200, 200, 200, 255]);
  });
});

describe('Distort family: uniform-color invariance is the baseline for correct geometry', () => {
  const color = [120, 80, 40];

  it('twirl: angle 0 changes nothing; a uniform image stays uniform however much it twists', () => {
    const data = flat(9, 9, color);
    const before = [...data];
    applyTwirl(9, 9, data, 0);
    expect([...data]).toEqual(before);

    applyTwirl(9, 9, data, 180);
    expectUniform(data, color);
  });

  it('twirl: the center stays put', () => {
    const data = flat(9, 9, [10, 10, 10]);
    // Center + one off-center bright dot: the center pixel must not be displaced
    data[(4 * 9 + 4) * 4] = 250;
    applyTwirl(9, 9, data, 90);
    expect(data[(4 * 9 + 4) * 4]).toBeGreaterThan(200);
  });

  it('spherize: 0 changes nothing, uniform stays uniform, the center stays put', () => {
    const data = flat(9, 9, [60, 60, 60]);
    const before = [...data];
    applySpherize(9, 9, data, 0);
    expect([...data]).toEqual(before);

    applySpherize(9, 9, data, 80);
    expectUniform(data, [60, 60, 60]);
    expect(pixel(data, 9, 4, 4)).toEqual([60, 60, 60]);
  });

  it('pinch: 0 changes nothing, uniform stays uniform', () => {
    const data = flat(9, 9, [30, 90, 150]);
    const before = [...data];
    applyPinch(9, 9, data, 0);
    expect([...data]).toEqual(before);

    applyPinch(9, 9, data, 100);
    expectUniform(data, [30, 90, 150]);
  });
});

describe('Stylize: edge detection', () => {
  /** Vertical step, black on the left and white on the right */
  const stepImage = (width = 6, height = 4) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = x < width / 2 ? 0 : 255;
        const offset = (y * width + x) * 4;
        data[offset] = value;
        data[offset + 1] = value;
        data[offset + 2] = value;
        data[offset + 3] = 255;
      }
    }
    return data;
  };

  it('find edges: flat areas go white and boundaries darken', () => {
    const flatData = flat(5, 5, [128, 128, 128]);
    applyFindEdges(5, 5, flatData);
    expectUniform(flatData, [255, 255, 255]);

    const data = stepImage();
    applyFindEdges(6, 4, data);
    expect(pixel(data, 6, 3, 1)[0]).toBeLessThan(255);
    expect(pixel(data, 6, 0, 1)[0]).toBe(255);
  });

  it('trace contour: areas below the threshold go white and boundaries darken by the threshold', () => {
    const flatData = flat(5, 5, [128, 128, 128]);
    applyTraceContour(5, 5, flatData, 128);
    expectUniform(flatData, [255, 255, 255]);

    const data = stepImage();
    applyTraceContour(6, 4, data, 128);
    const boundary = [pixel(data, 6, 2, 1)[0], pixel(data, 6, 3, 1)[0]];
    expect(boundary).toContain(0);
  });

  it('a higher threshold draws contours more readily', () => {
    const low = stepImage();
    const high = stepImage();
    applyTraceContour(6, 4, low, 40);
    applyTraceContour(6, 4, high, 900);
    const countBlack = (data: Uint8ClampedArray) =>
      data.reduce((sum, value, index) => (index % 4 === 0 && value === 0 ? sum + 1 : sum), 0);
    expect(countBlack(low)).toBeGreaterThanOrEqual(countBlack(high));
  });
});

describe('Render family', () => {
  it('clouds: deterministic (baking twice with the same parameters gives the same result)', () => {
    const a = flat(16, 16, [0, 0, 0]);
    const b = flat(16, 16, [0, 0, 0]);
    applyClouds(16, 16, a, 80, 16);
    applyClouds(16, 16, b, 80, 16);
    expect([...a]).toEqual([...b]);
  });

  it('clouds: strength 0 changes nothing, strength 100 replaces the image with noise (light and dark appear)', () => {
    const untouched = flat(16, 16, [10, 20, 30]);
    const before = [...untouched];
    applyClouds(16, 16, untouched, 0, 16);
    expect([...untouched]).toEqual(before);

    const data = flat(24, 24, [0, 0, 0]);
    applyClouds(24, 24, data, 100, 8);
    const values = data.filter((_, index) => index % 4 === 0);
    expect(Math.max(...values)).toBeGreaterThan(40);
    expect(Math.min(...values)).toBeLessThan(240);
  });

  it('lens flare: 0 changes nothing; the flare spot brightens while far areas barely change', () => {
    const data = flat(40, 40, [0, 0, 0]);
    const before = [...data];
    applyLensFlare(40, 40, data, 0, 40, 50, 50);
    expect([...data]).toEqual(before);

    applyLensFlare(40, 40, data, 100, 40, 50, 50);
    const center = pixel(data, 40, 20, 20)[0];
    const corner = pixel(data, 40, 0, 0)[0];
    // The center brightens noticeably; a corner must stay far dimmer even if it happens to land on a ghost halo
    expect(center).toBeGreaterThan(150);
    expect(corner).toBeLessThan(center * 0.25);
  });
});

describe('Noise reduction: median filter', () => {
  it('strength 0 leaves the image unchanged', () => {
    const data = flat(5, 5, [100, 100, 100]);
    const before = [...data];
    applyReduceNoise(5, 5, data, 0, 1);
    expect([...data]).toEqual(before);
  });

  it('a uniform image stays uniform', () => {
    const data = flat(7, 7, [77, 88, 99]);
    applyReduceNoise(7, 7, data, 100, 1);
    expectUniform(data, [77, 88, 99]);
  });

  it('isolated bright dots are flattened (salt and pepper noise)', () => {
    const data = flat(5, 5, [0, 0, 0]);
    const center = (2 * 5 + 2) * 4;
    data[center] = 255;
    data[center + 1] = 255;
    data[center + 2] = 255;
    applyReduceNoise(5, 5, data, 100, 1);
    expect(pixel(data, 5, 2, 2)).toEqual([0, 0, 0]);
  });

  it('strength 50 only halves the effect', () => {
    const data = flat(5, 5, [0, 0, 0]);
    const center = (2 * 5 + 2) * 4;
    data[center] = 200;
    data[center + 1] = 200;
    data[center + 2] = 200;
    applyReduceNoise(5, 5, data, 50, 1);
    expect(pixel(data, 5, 2, 2)[0]).toBe(100);
  });

  it('radius 3 also erases larger blobs', () => {
    const data = flat(9, 9, [0, 0, 0]);
    for (const [x, y] of [
      [4, 4],
      [5, 4],
      [4, 5],
    ]) {
      const offset = (y * 9 + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
    }
    applyReduceNoise(9, 9, data, 100, 3);
    expect(pixel(data, 9, 4, 4)).toEqual([0, 0, 0]);
  });
});
