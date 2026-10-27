import { describe, expect, it } from 'vitest';
import {
  COLOR_CHANNELS,
  MAX_SAMPLES,
  extractChannelData,
  extractPalette,
  MASK_SELECTION_THRESHOLD,
  hexToRgb,
  maskRunsToParts,
  partsBounds,
  rgbToHex,
  selectionFromMask,
  selectionFromParts,
} from './core';
import { migrateDoc } from './model/migrate';
import type { PhotoDoc } from './model/types';

/** Build RGBA data: `pixels` is a list of [r,g,b,a] */
function pixels(list: number[][]): Uint8ClampedArray {
  return new Uint8ClampedArray(list.flat());
}

describe('Channel constants', () => {
  it('three color channels, with at most 4 sample points (as in Photoshop)', () => {
    expect(COLOR_CHANNELS).toEqual(['red', 'green', 'blue']);
    expect(MAX_SAMPLES).toBe(4);
  });
});

describe('extractChannelData: single-channel isolation', () => {
  it('red channel: all three components equal the original R (rendered as gray, not red)', () => {
    const data = pixels([
      [10, 200, 30, 255],
      [255, 0, 128, 255],
    ]);
    extractChannelData(data, 'red');
    expect([...data]).toEqual([10, 10, 10, 255, 255, 255, 255, 255]);
  });

  it('green / blue channels take their own component', () => {
    const green = pixels([[10, 200, 30, 255]]);
    extractChannelData(green, 'green');
    expect([...green].slice(0, 3)).toEqual([200, 200, 200]);

    const blue = pixels([[10, 200, 30, 255]]);
    extractChannelData(blue, 'blue');
    expect([...blue].slice(0, 3)).toEqual([30, 30, 30]);
  });

  it('alpha is preserved', () => {
    const data = pixels([[10, 200, 30, 40]]);
    extractChannelData(data, 'red');
    expect(data[3]).toBe(40);
  });
});

describe('maskRunsToParts: mask scanlines to selection', () => {
  it('turns each row run into a union of rectangles', () => {
    // 2×2: both pixels of the first row selected, only the left pixel of the second
    const data = new Uint8ClampedArray(2 * 2 * 4);
    for (const index of [0, 1, 2]) data[index * 4 + 3] = 255;
    const parts = maskRunsToParts(data, 2, 2, 128, 'alpha');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ path: [0, 0, 2, 0, 2, 1, 0, 1], add: true });
    expect(parts[1]).toEqual({ path: [0, 1, 1, 1, 1, 2, 0, 2], add: true });
  });

  it('an empty mask produces an empty outline', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    expect(maskRunsToParts(data, 4, 4, 128, 'alpha')).toEqual([]);
  });

  it('judges by luminance by default (for channel images / grayscale masks)', () => {
    // White pixel (luminance 255) selected, black pixel (luminance 0) not selected
    const data = pixels([
      [255, 255, 255, 255],
      [0, 0, 0, 255],
    ]);
    const parts = maskRunsToParts(data, 2, 1, 128);
    expect(parts).toHaveLength(1);
    expect(parts[0].path).toEqual([0, 0, 1, 0, 1, 1, 0, 1]);
  });

  it('semi-transparent pixels below the threshold are not selected', () => {
    const data = new Uint8ClampedArray(2 * 1 * 4);
    data[3] = 100; // first pixel alpha=100 < 128
    data[7] = 200; // second pixel alpha=200
    const parts = maskRunsToParts(data, 2, 1, 128, 'alpha');
    expect(parts).toHaveLength(1);
    expect(parts[0].path).toEqual([1, 0, 2, 0, 2, 1, 1, 1]);
  });
});

describe('partsBounds / selectionFromParts', () => {
  it('derives the bounding box from the rectangle union', () => {
    const bounds = partsBounds([
      { path: [2, 3, 6, 3, 6, 4, 2, 4], add: true },
      { path: [4, 5, 9, 5, 9, 8, 4, 8], add: true },
    ]);
    expect(bounds).toEqual({ x: 2, y: 3, width: 7, height: 5 });
  });

  it('builds a lasso selection: the first run is the main outline, the rest are unions', () => {
    const selection = selectionFromParts([
      { path: [0, 0, 4, 0, 4, 2, 0, 2], add: true },
      { path: [0, 2, 2, 2, 2, 4, 0, 4], add: true },
    ]);
    expect(selection).not.toBeNull();
    expect(selection?.kind).toBe('lasso');
    expect(selection?.parts).toHaveLength(2);
    expect(selection?.width).toBe(4);
    expect(selection?.height).toBe(4);
  });

  it('outlines with too few points are dropped; null when all are invalid', () => {
    expect(selectionFromParts([{ path: [0, 0, 1, 1], add: true }])).toBeNull();
    expect(selectionFromParts([])).toBeNull();
  });
});

describe('selectionFromMask: grayscale mask to selection (quick-mask exit / channel load)', () => {
  it('white areas become the selection, black areas do not', () => {
    // 3×1: white / black / white — the union of two spans
    const data = pixels([
      [255, 255, 255, 255],
      [0, 0, 0, 255],
      [255, 255, 255, 255],
    ]);
    const selection = selectionFromMask(data, 3, 1);
    expect(selection).not.toBeNull();
    expect(selection?.parts).toHaveLength(2);
    expect(selection?.x).toBe(0);
    expect(selection?.width).toBe(3);
    expect(selection?.height).toBe(1);
  });

  it('an all-black mask (nothing selected) returns null', () => {
    const data = new Uint8ClampedArray(2 * 2 * 4);
    expect(selectionFromMask(data, 2, 2)).toBeNull();
  });

  it('the threshold is adjustable: gray 100 is not selected by default but is once the threshold drops to 80', () => {
    const data = pixels([
      [100, 100, 100, 255],
      [0, 0, 0, 255],
    ]);
    expect(selectionFromMask(data, 2, 1)).toBeNull();
    expect(selectionFromMask(data, 2, 1, 80)).not.toBeNull();
    expect(MASK_SELECTION_THRESHOLD).toBe(128);
  });

  it('an opaque all-black mask is not select-all (luminance is the criterion, not alpha)', () => {
    const data = new Uint8ClampedArray(2 * 2 * 4).fill(255);
    // fill(255) would set RGB to 255 as well → select all; build alpha=255, RGB=0 explicitly here
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
    expect(selectionFromMask(data, 2, 2)).toBeNull();
  });
});

describe('extractPalette: dominant colors', () => {
  it('returns the most frequent colors, uppercased', () => {
    const list: number[][] = [];
    for (let i = 0; i < 50; i += 1) list.push([200, 20, 20, 255]);
    for (let i = 0; i < 20; i += 1) list.push([20, 20, 200, 255]);
    const palette = extractPalette(pixels(list), 4);
    expect(palette[0]).toBe('#C81414');
    expect(palette[1]).toBe('#1414C8');
  });

  it('skips transparent pixels (so transparent 0,0,0 never reaches the palette)', () => {
    const list: number[][] = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [10, 200, 30, 255],
    ];
    const palette = extractPalette(pixels(list), 4);
    expect(palette).toEqual(['#0AC81E']);
  });

  it('dedupes near-identical colors so one hue cannot fill every slot', () => {
    const list: number[][] = [];
    for (let i = 0; i < 30; i += 1) list.push([120, 120, 120, 255]);
    for (let i = 0; i < 20; i += 1) list.push([128, 128, 128, 255]);
    for (let i = 0; i < 10; i += 1) list.push([0, 128, 0, 255]);
    const palette = extractPalette(pixels(list), 8);
    // The two gray zones are very close → keep only one
    expect(palette).toHaveLength(2);
  });

  it('empty data returns an empty palette', () => {
    expect(extractPalette(new Uint8ClampedArray(0), 4)).toEqual([]);
  });

  it('rgbToHex / hexToRgb round-trip (and clamp out-of-range components)', () => {
    expect(rgbToHex(10, 200, 30)).toBe('#0AC81E');
    expect(rgbToHex(-5, 300, 30)).toBe('#00FF1E');
    expect(hexToRgb('#0AC81E')).toEqual({ r: 10, g: 200, b: 30 });
    expect(hexToRgb('nope')).toBeNull();
  });
});

describe('migrateDoc: normalizing the document palette', () => {
  const raw = (swatches: unknown) => ({
    id: 'doc-1',
    name: 'n',
    width: 100,
    height: 100,
    background: 'white',
    layers: [],
    activeLayerId: null,
    swatches,
  });

  function parse(input: unknown): PhotoDoc {
    const parsed = migrateDoc(input);
    if (!parsed) throw new Error('migrateDoc 返回 null');
    return parsed;
  }

  it('old projects without a swatches field get an empty array', () => {
    expect(parse(raw(undefined)).swatches).toEqual([]);
  });

  it('drops illegal colors, dedupes and uppercases', () => {
    const parsed = parse(raw(['#ffffff', 'red', '#FFFFFF', '#0ac81e']));
    expect(parsed.swatches).toEqual(['#FFFFFF', '#0AC81E']);
  });

  it('truncates beyond the capacity limit', () => {
    const many = Array.from({ length: 40 }, (_, i) => `#${(i * 3).toString(16).padStart(6, '0')}`);
    expect(parse(raw(many)).swatches.length).toBeLessThanOrEqual(32);
  });
});
