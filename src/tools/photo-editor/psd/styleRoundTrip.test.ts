import { describe, expect, it } from 'vitest';
import { initializeCanvas, readPsd, writePsdUint8Array } from 'ag-psd';
import {
  createColorOverlay,
  createDropShadow,
  createInnerShadow,
  createOuterGlow,
  createStroke,
} from '../core';
import { mapPsdEffects } from './importMap';
import { toPsdEffects } from './styleMap';
import type { LayerStyle } from '../model/types';

/**
 * **Real round-trip** tests for layer effects: our style → `toPsdEffects` → ag-psd writes PSD bytes → ag-psd reads back → `mapPsdEffects`.
 *
 * Why not test the mapping functions alone: the unit conventions on the write side (especially ag-psd's
 * `opacity` being 0~1 FixedPoint8) only hold up after a real serialization. This suite is what caught the read side
 * treating opacity as a percentage — a bug that surfaces as "the drop shadow in the PSD is invisible" and is hard to attribute.
 *
 * Pixels travel as `imageData` + `useImageData`, so the whole chain needs no Canvas (runs under jsdom).
 */

const PIXELS = new Uint8ClampedArray(2 * 2 * 4).fill(200);

/**
 * jsdom has no 2D context, while ag-psd's read path calls `createImageData` (whose default needs a scratch canvas).
 * `initializeCanvas` is the injection point for exactly this: it gets a stand-in that only allocates ImageData and paints nothing.
 * With `useImageData: true` ag-psd reads the raw pixel buffer, so real drawing capability is never needed.
 */
initializeCanvas(
  (width = 1, height = 1) =>
    ({
      width,
      height,
      getContext: () => null,
      toDataURL: () => '',
    }) as unknown as HTMLCanvasElement,
  (width, height) =>
    ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }) as unknown as ImageData,
);

function roundTrip(style: LayerStyle | null): LayerStyle | null {
  const effects = toPsdEffects(style);
  const bytes = writePsdUint8Array({
    width: 2,
    height: 2,
    children: [
      {
        name: 'Layer',
        top: 0,
        left: 0,
        bottom: 2,
        right: 2,
        imageData: { data: PIXELS, width: 2, height: 2 },
        ...(effects ? { effects } : {}),
      },
    ],
  } as never);
  const psd = readPsd(bytes, {
    useImageData: true,
    skipCompositeImageData: true,
    skipThumbnail: true,
  });
  return mapPsdEffects((psd.children?.[0] as { effects?: never } | undefined)?.effects);
}

describe('Edge cases when writing layer effects', () => {
  it('no style / empty style returns undefined (ag-psd skips the lfx2 block entirely)', () => {
    expect(toPsdEffects(null)).toBeUndefined();
    expect(toPsdEffects({})).toBeUndefined();
  });

  it('disabled effects are still written (parameters kept, just marked disabled)', () => {
    const shadow = { ...createDropShadow(), enabled: false };
    const effects = toPsdEffects({ dropShadow: shadow });
    expect(effects?.dropShadow?.[0]).toMatchObject({ present: true, enabled: false });
  });

  it('sizes are always written as { units: Pixels, value } (a bare number serializes as 0)', () => {
    const effects = toPsdEffects({ dropShadow: { ...createDropShadow(), distance: 7, spread: 3 } });
    expect(effects?.dropShadow?.[0].distance).toEqual({ units: 'Pixels', value: 7 });
    expect(effects?.dropShadow?.[0].choke).toEqual({ units: 'Pixels', value: 3 });
  });
});

describe('Drop shadow round-trip', () => {
  it('color / opacity / angle / distance / spread / blur are all preserved', () => {
    const style: LayerStyle = {
      dropShadow: {
        ...createDropShadow(),
        enabled: true,
        color: '#FF8000',
        opacity: 0.6,
        angle: 135,
        distance: 9,
        spread: 4,
        size: 12,
      },
    };
    const back = roundTrip(style);
    expect(back?.dropShadow).toMatchObject({
      enabled: true,
      color: '#FF8000',
      angle: 135,
      distance: 9,
      spread: 4,
      size: 12,
    });
    // Opacity is 0~1 FixedPoint8: allow a 1/255 quantization error
    expect(back?.dropShadow?.opacity).toBeCloseTo(0.6, 2);
  });

  it('inner shadow round-trip (no spread parameter)', () => {
    const back = roundTrip({
      innerShadow: {
        ...createInnerShadow(),
        enabled: true,
        color: '#0000FF',
        opacity: 1,
        angle: 90,
        distance: 5,
        size: 8,
      },
    });
    expect(back?.innerShadow).toMatchObject({ color: '#0000FF', angle: 90, distance: 5, size: 8 });
    expect(back?.innerShadow?.opacity).toBeCloseTo(1, 2);
  });
});

describe('Outer glow / color overlay / stroke round-trip', () => {
  it('outer glow: color and radius are preserved', () => {
    const back = roundTrip({
      outerGlow: { ...createOuterGlow(), enabled: true, color: '#22C55E', opacity: 0.75, size: 14 },
    });
    expect(back?.outerGlow).toMatchObject({ enabled: true, color: '#22C55E', size: 14 });
    expect(back?.outerGlow?.opacity).toBeCloseTo(0.75, 2);
  });

  it('color overlay: uses the PSD solidFill', () => {
    const back = roundTrip({
      colorOverlay: { ...createColorOverlay(), enabled: true, color: '#123456', opacity: 0.5 },
    });
    expect(back?.colorOverlay).toMatchObject({ enabled: true, color: '#123456' });
    expect(back?.colorOverlay?.opacity).toBeCloseTo(0.5, 2);
  });

  it('stroke: position and size are preserved (outside / inside / center)', () => {
    for (const position of ['outside', 'inside', 'center'] as const) {
      const back = roundTrip({
        stroke: {
          ...createStroke(),
          enabled: true,
          color: '#FFFFFF',
          opacity: 1,
          size: 6,
          position,
        },
      });
      expect(back?.stroke).toMatchObject({ enabled: true, color: '#FFFFFF', size: 6, position });
    }
  });
});

describe('Multiple effects together', () => {
  it('five effects written at once all read back', () => {
    const back = roundTrip({
      dropShadow: { ...createDropShadow(), enabled: true, size: 6 },
      innerShadow: { ...createInnerShadow(), enabled: true, size: 4 },
      outerGlow: { ...createOuterGlow(), enabled: true, size: 10 },
      colorOverlay: { ...createColorOverlay(), enabled: true, color: '#ABCDEF' },
      stroke: { ...createStroke(), enabled: true, size: 3, position: 'outside' },
    });
    expect(back).not.toBeNull();
    expect(Object.keys(back ?? {}).sort()).toEqual([
      'colorOverlay',
      'dropShadow',
      'innerShadow',
      'outerGlow',
      'stroke',
    ]);
  });

  it('no style reads back as null (no effects are invented)', () => {
    expect(roundTrip(null)).toBeNull();
  });
});
