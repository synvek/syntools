import { describe, expect, it } from 'vitest';
import {
  buildOutputFilename,
  clampQuality,
  compressionRatio,
  computeTargetSize,
  formatBytes,
  formatById,
  IMAGE_FORMATS,
  isImageFile,
  MAX_DIMENSIONS,
} from './core';

describe('IMAGE_FORMATS / formatById', () => {
  it('格式白名单与查找', () => {
    expect(IMAGE_FORMATS.map((f) => f.id)).toEqual(['image/png', 'image/jpeg', 'image/webp']);
    expect(formatById('image/jpeg')?.ext).toBe('jpg');
    expect(formatById('image/gif')).toBeNull();
  });
});

describe('clampQuality', () => {
  it('钳制到 [0.1, 1]，非法值回退 0.8', () => {
    expect(clampQuality(0.5)).toBe(0.5);
    expect(clampQuality(0)).toBe(0.1);
    expect(clampQuality(2)).toBe(1);
    expect(clampQuality(Number.NaN)).toBe(0.8);
    expect(clampQuality(Number.POSITIVE_INFINITY)).toBe(0.8);
  });
});

describe('isImageFile', () => {
  it('MIME 前缀判断', () => {
    expect(isImageFile('image/png')).toBe(true);
    expect(isImageFile('IMAGE/JPEG')).toBe(true);
    expect(isImageFile('text/plain')).toBe(false);
    expect(isImageFile('')).toBe(false);
  });
});

describe('computeTargetSize', () => {
  it('maxDim=0 或尺寸未超限：保持原样', () => {
    expect(computeTargetSize(800, 600, 0)).toEqual({ width: 800, height: 600 });
    expect(computeTargetSize(800, 600, 1024)).toEqual({ width: 800, height: 600 });
    expect(computeTargetSize(1024, 1024, 1024)).toEqual({ width: 1024, height: 1024 });
  });

  it('超限时等比缩小（以最长边为准，不放大）', () => {
    expect(computeTargetSize(4000, 2000, 2048)).toEqual({ width: 2048, height: 1024 });
    expect(computeTargetSize(2000, 4000, 1024)).toEqual({ width: 512, height: 1024 });
  });

  it('极扁图片缩放宽高至少为 1', () => {
    const result = computeTargetSize(10_000, 3, 512);
    expect(result.width).toBe(512);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });
});

describe('buildOutputFilename', () => {
  it('替换扩展名', () => {
    expect(buildOutputFilename('photo.png', 'image/jpeg')).toBe('photo.jpg');
    expect(buildOutputFilename('a.b.c.webp', 'image/png')).toBe('a.b.c.png');
  });

  it('无扩展名 / 空名兜底', () => {
    expect(buildOutputFilename('photo', 'image/webp')).toBe('photo.webp');
    expect(buildOutputFilename('  ', 'image/webp')).toBe('image.webp');
    expect(buildOutputFilename('x.gif', 'image/avif')).toBe('x.png');
  });
});

describe('compressionRatio', () => {
  it('节省与增大', () => {
    expect(compressionRatio(1000, 400)).toBe(60);
    expect(compressionRatio(1000, 1200)).toBe(-20);
    expect(compressionRatio(0, 100)).toBeNull();
  });
});

describe('formatBytes', () => {
  it('B / KB / MB 展示', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.00 MB');
  });
});

describe('MAX_DIMENSIONS', () => {
  it('选项白名单', () => {
    expect(MAX_DIMENSIONS).toEqual([0, 2048, 1024, 512]);
  });
});
