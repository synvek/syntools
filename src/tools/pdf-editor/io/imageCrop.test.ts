import { describe, expect, it } from 'vitest';
import {
  MIN_CROP,
  clampCrop,
  cropImageDataUrl,
  croppedSize,
  fullCrop,
  isFullCrop,
  moveCrop,
  resizeCrop,
} from './imageCrop';

describe('clampCrop', () => {
  it('限幅到 0–1 并保持最小尺寸', () => {
    expect(clampCrop({ x: -0.2, y: 0.9, w: 0.01, h: 2 })).toEqual({
      x: 0,
      y: 0,
      w: MIN_CROP,
      h: 1,
    });
  });

  it('非有限值回退到最小窗口', () => {
    expect(clampCrop({ x: Number.NaN, y: 0, w: 0.5, h: 0.5 }).x).toBe(0);
  });
});

describe('moveCrop', () => {
  it('尺寸不变且不越界', () => {
    const crop = { x: 0.1, y: 0.1, w: 0.4, h: 0.4 };
    expect(moveCrop(crop, 0.1, 0.1)).toEqual({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 });
    expect(moveCrop(crop, 0.9, -0.9)).toEqual({ x: 0.6, y: 0, w: 0.4, h: 0.4 });
  });
});

describe('resizeCrop', () => {
  it('拖右下角缩小，左上角固定', () => {
    expect(resizeCrop(fullCrop(), 'se', -0.25, -0.25)).toEqual({
      x: 0,
      y: 0,
      w: 0.75,
      h: 0.75,
    });
  });

  it('拖左上角缩小，右下角固定', () => {
    expect(resizeCrop(fullCrop(), 'nw', 0.2, 0.3)).toEqual({
      x: 0.2,
      y: 0.3,
      w: 0.8,
      h: 0.7,
    });
  });

  it('最小窗口不会被拖没', () => {
    const crop = resizeCrop(fullCrop(), 'se', -2, -2);
    expect(crop.w).toBe(MIN_CROP);
    expect(crop.h).toBe(MIN_CROP);
  });
});

describe('croppedSize / isFullCrop', () => {
  it('按裁剪比例取整，至少 1px', () => {
    expect(croppedSize({ width: 1000, height: 500 }, { x: 0, y: 0, w: 0.5, h: 0.5 })).toEqual({
      width: 500,
      height: 250,
    });
    expect(croppedSize({ width: 10, height: 10 }, { x: 0, y: 0, w: 0.01, h: 0.01 })).toEqual({
      width: 1,
      height: 1,
    });
  });

  it('全图判断带容差', () => {
    expect(isFullCrop(fullCrop())).toBe(true);
    expect(isFullCrop({ x: 0.01, y: 0, w: 0.99, h: 1 })).toBe(false);
  });
});

describe('cropImageDataUrl', () => {
  it('全图时原样返回，不依赖 canvas', async () => {
    const dataUrl = 'data:image/png;base64,AAAA';
    await expect(cropImageDataUrl(dataUrl, fullCrop(), { width: 10, height: 10 })).resolves.toBe(
      dataUrl,
    );
  });
});
