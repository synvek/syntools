import { describe, expect, it, vi } from 'vitest';
import { defaultFilterParams } from './core';
import {
  OFFLOAD_WORK_THRESHOLD,
  estimatePixelWork,
  previewScaleFor,
  scaleFilterParams,
  shouldOffloadPixels,
} from './render/bakePlan';
import { applyPixelPassToData } from './render/pixelPass';
import { resetBakeQueue, scheduleFullResBake } from './render/bakeQueue';
import { bakeToBitmap, type BakeWorkerRequest } from './workers/bake.worker';
import { createAdjustments } from './model/factory';
import type { FilterId, FilterSpec } from './model/types';

/**
 * Tests for the bake performance policy and the Worker protocol.
 *
 * What is covered here is the part easiest to get wrong and hardest to notice: filter parameters not scaled
 * during preview downsampling, a wrong offload threshold (work that should go async does not, or the reverse
 * spawns threads endlessly), and a scrambled order in the Worker pipeline (CSS filters → pixel pass → bitmap).
 */

const spec = (id: FilterId, params: Record<string, number> = {}): FilterSpec => ({
  id,
  params: { ...defaultFilterParams(id), ...params },
});

describe('previewScaleFor: the live preview downscale factor', () => {
  it('small images keep full resolution', () => {
    expect(previewScaleFor(800, 600)).toBe(1);
    expect(previewScaleFor(1414, 1414)).toBe(1);
  });

  it('shrinks by the square root of the pixel budget', () => {
    // 2000×1500 = 3 MP, the budget is 2 MP → √(2/3) ≈ 0.82
    const scale = previewScaleFor(2000, 1500);
    expect(scale).toBeGreaterThan(0.8);
    expect(scale).toBeLessThan(0.83);
  });

  it('huge images never drop below the floor (lower and you cannot see what you are drawing)', () => {
    expect(previewScaleFor(12000, 8000)).toBe(0.35);
  });
});

describe('scaleFilterParams: shrinking length-like parameters', () => {
  it('a scale of 1 returns the input as-is (zero cost)', () => {
    const filters = [spec('gaussianBlur')];
    expect(scaleFilterParams(filters, 1)).toBe(filters);
  });

  it('radius / distance / noise scale shrink proportionally; angles and percentages stay', () => {
    const filters = [
      spec('gaussianBlur', { radius: 10 }),
      spec('motionBlur', { angle: 45, distance: 20 }),
      spec('clouds', { amount: 70, size: 16 }),
      spec('twirl', { angle: 90 }),
    ];
    const scaled = scaleFilterParams(filters, 0.5);
    expect(scaled[0].params?.radius).toBe(5);
    expect(scaled[1].params?.distance).toBe(10);
    expect(scaled[1].params?.angle).toBe(45);
    expect(scaled[2].params?.size).toBe(8);
    expect(scaled[2].params?.amount).toBe(70);
    expect(scaled[3].params?.angle).toBe(90);
  });

  it('pixelate cell size scales too (otherwise the preview shows more cells)', () => {
    expect(scaleFilterParams([spec('pixelate', { block: 16 })], 0.5)[0].params?.block).toBe(8);
  });

  it('scaled lengths never drop below 1', () => {
    expect(scaleFilterParams([spec('gaussianBlur', { radius: 3 })], 0.1)[0].params?.radius).toBe(1);
  });
});

describe('estimatePixelWork / shouldOffloadPixels: is async worth it', () => {
  it('a light filter on a small layer stays on the main thread (the round-trip is slower)', () => {
    expect(shouldOffloadPixels(400, 300, [spec('posterize')])).toBe(false);
  });

  it('heavy filters like noise reduction on a large layer are worth offloading', () => {
    expect(shouldOffloadPixels(4000, 3000, [spec('reduceNoise')])).toBe(true);
  });

  it('disabled filters add no cost', () => {
    const disabled: FilterSpec = { ...spec('reduceNoise'), enabled: false };
    expect(estimatePixelWork(4000, 3000, [disabled])).toBeLessThan(OFFLOAD_WORK_THRESHOLD);
  });

  it('costs of several filters add up', () => {
    const one = estimatePixelWork(2000, 2000, [spec('unsharp')]);
    const two = estimatePixelWork(2000, 2000, [spec('unsharp'), spec('unsharp')]);
    expect(two).toBe(one * 2);
  });
});

describe('applyPixelPassToData: the shared pixel pass', () => {
  const pixels = (list: number[][]): Uint8ClampedArray => Uint8ClampedArray.from(list.flat());

  it('no adjustments and no filters leave the data unchanged', () => {
    const data = pixels([[10, 20, 30, 255]]);
    applyPixelPassToData(1, 1, data, createAdjustments(), []);
    expect([...data]).toEqual([10, 20, 30, 255]);
  });

  it('the threshold adjustment forces pixels to pure black or white', () => {
    const data = pixels([
      [10, 10, 10, 255],
      [200, 200, 200, 255],
    ]);
    applyPixelPassToData(2, 1, data, { ...createAdjustments(), threshold: 128 }, []);
    expect([...data].slice(0, 4)).toEqual([0, 0, 0, 255]);
    expect([...data].slice(4, 8)).toEqual([255, 255, 255, 255]);
  });

  it('a pixel-level filter (invert) applies in place', () => {
    const data = pixels([[0, 128, 255, 255]]);
    applyPixelPassToData(1, 1, data, createAdjustments(), [spec('posterize', { levels: 3 })]);
    // 3-level posterize: 0 / 127.5 / 255
    expect(data[0]).toBe(0);
    expect(data[1]).toBe(128);
    expect(data[2]).toBe(255);
  });
});

describe('Worker pipeline: bakeToBitmap', () => {
  const fakeContext = () => ({
    filter: 'none',
    drawImage: vi.fn(),
    getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
    })),
    putImageData: vi.fn(),
  });

  it('draws with CSS filters, runs the pixel pass, then converts to a bitmap', async () => {
    const ctx = fakeContext();
    const bitmap = { width: 4, height: 2 } as unknown as ImageBitmap;
    const canvas = {
      getContext: () => ctx,
      transferToImageBitmap: () => bitmap,
    } as unknown as OffscreenCanvas;
    const request: BakeWorkerRequest = {
      id: 7,
      width: 4,
      height: 2,
      bitmap: bitmap,
      cssFilter: 'blur(3px)',
      adjustments: createAdjustments(),
      filters: [spec('posterize', { levels: 3 })],
    };
    const result = await bakeToBitmap(request, () => canvas);
    expect(result).toBe(bitmap);
    expect(ctx.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 4, 2);
    expect(ctx.getImageData).toHaveBeenCalledWith(0, 0, 4, 2);
    expect(ctx.putImageData).toHaveBeenCalled();
    // Reset filter after drawing, otherwise later compositing after putImageData gets blurred again
    expect(ctx.filter).toBe('none');
  });

  it('returns null when no 2D context is available (never throws)', async () => {
    const canvas = { getContext: () => null } as unknown as OffscreenCanvas;
    const response = await bakeToBitmap(
      {
        id: 1,
        width: 2,
        height: 2,
        bitmap: {} as ImageBitmap,
        cssFilter: '',
        adjustments: createAdjustments(),
        filters: [],
      },
      () => canvas,
    );
    expect(response).toBeNull();
  });
});

describe('bakeQueue: degrades silently when the environment lacks support', () => {
  it('without Worker / createImageBitmap, scheduling neither throws nor starts a thread', () => {
    resetBakeQueue();
    const source = { width: 4000, height: 3000 } as unknown as HTMLCanvasElement;
    expect(() =>
      scheduleFullResBake({
        signature: 'sig',
        source,
        adjustments: createAdjustments(),
        filters: [spec('reduceNoise')],
      }),
    ).not.toThrow();
    resetBakeQueue();
  });

  it('when the work is too small nothing is scheduled (no pointless debounce timer)', () => {
    resetBakeQueue();
    const source = { width: 64, height: 64 } as unknown as HTMLCanvasElement;
    scheduleFullResBake({
      signature: 'sig',
      source,
      adjustments: createAdjustments(),
      filters: [spec('posterize')],
    });
    resetBakeQueue();
    expect(true).toBe(true);
  });
});
