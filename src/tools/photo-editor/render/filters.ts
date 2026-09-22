import { buildFilterString, needsPixelPass } from '../core';
import type { Adjustments, FilterId } from '../model/types';

/**
 * 调整 / 滤镜烘焙管线。
 *
 * 预览与导出共用同一条管线，保证「所见即所得」：
 * 1. 先用 Canvas2D 的 `ctx.filter` 应用 CSS 能表达的部分（亮度 / 对比度 / 饱和度 / 色相 / 模糊 / 灰度 / 复古 / 反相）；
 * 2. 再用 ImageData 通道处理需要逐像素运算的部分（色温、锐化、浮雕、边缘、噪点、像素化、色调分离）。
 *
 * 结果按参数签名缓存：拖动滑杆时不重复烘焙未变化的图层。
 */

const CACHE_LIMIT = 24;
const cache = new Map<string, HTMLCanvasElement>();

export function clearBakeCache(): void {
  cache.clear();
}

export function bakeRaster(
  source: HTMLCanvasElement,
  signature: string,
  adjustments: Adjustments,
  filters: FilterId[],
): HTMLCanvasElement {
  const cached = cache.get(signature);
  if (cached) return cached;
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d', { willReadFrequently: needsPixelPass(adjustments, filters) });
  if (!ctx) return source;

  const cssFilter = [...cssParts(adjustments), ...filterParts(filters)].join(' ');
  if (cssFilter) ctx.filter = cssFilter;
  ctx.drawImage(source, 0, 0);
  ctx.filter = 'none';

  if (needsPixelPass(adjustments, filters)) applyPixelPass(ctx, source, adjustments, filters);

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(signature, out);
  return out;
}

function cssParts(adjustments: Adjustments): string[] {
  const parts = buildFilterString(adjustments);
  return parts ? [parts] : [];
}

function filterParts(filters: FilterId[]): string[] {
  const parts: string[] = [];
  if (filters.includes('grayscale')) parts.push('grayscale(1)');
  if (filters.includes('sepia')) parts.push('sepia(1)');
  if (filters.includes('invert')) parts.push('invert(1)');
  if (filters.includes('blur')) parts.push('blur(4px)');
  return parts;
}

function applyPixelPass(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  adjustments: Adjustments,
  filters: FilterId[],
): void {
  const { width, height } = source;
  const frame = ctx.getImageData(0, 0, width, height);
  const data = frame.data;

  if (adjustments.temperature !== 0) applyTemperature(data, adjustments.temperature);
  if (adjustments.sharpen > 0) {
    applyConvolution(width, height, data, SHARPEN_KERNEL, 1, 0, adjustments.sharpen / 100);
  }
  if (filters.includes('emboss')) applyConvolution(width, height, data, EMBOSS_KERNEL, 1, 128, 1);
  if (filters.includes('edge')) applyConvolution(width, height, data, EDGE_KERNEL, 1, 128, 1);
  if (filters.includes('noise')) applyNoise(data, 24);
  if (filters.includes('pixelate')) applyPixelate(width, height, data, 8);
  if (filters.includes('posterize')) applyPosterize(data, 4);

  ctx.putImageData(frame, 0, 0);
}

const SHARPEN_KERNEL = [0, -1, 0, -1, 5, -1, 0, -1, 0];
const EMBOSS_KERNEL = [-2, -1, 0, -1, 1, 1, 0, 1, 2];
const EDGE_KERNEL = [0, 1, 0, 1, -4, 1, 0, 1, 0];

/** 3×3 卷积：`amount` 用于把结果与原图混合（锐化强度） */
function applyConvolution(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  kernel: number[],
  divisor: number,
  offset: number,
  amount: number,
): void {
  const copy = new Uint8ClampedArray(data);
  const mix = Math.max(0, Math.min(1, amount));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          const px = Math.min(width - 1, Math.max(0, x + kx));
          const py = Math.min(height - 1, Math.max(0, y + ky));
          const index = (py * width + px) * 4;
          const weight = kernel[(ky + 1) * 3 + (kx + 1)];
          r += copy[index] * weight;
          g += copy[index + 1] * weight;
          b += copy[index + 2] * weight;
        }
      }
      const index = (y * width + x) * 4;
      const nr = r / divisor + offset;
      const ng = g / divisor + offset;
      const nb = b / divisor + offset;
      data[index] = copy[index] + (nr - copy[index]) * mix;
      data[index + 1] = copy[index + 1] + (ng - copy[index + 1]) * mix;
      data[index + 2] = copy[index + 2] + (nb - copy[index + 2]) * mix;
    }
  }
}

/** 色温：正值偏暖（提 R 压 B），负值偏冷 */
function applyTemperature(data: Uint8ClampedArray, temperature: number): void {
  const shift = (temperature / 100) * 32;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clampByte(data[i] + shift);
    data[i + 2] = clampByte(data[i + 2] - shift);
  }
}

function applyNoise(data: Uint8ClampedArray, amount: number): void {
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * amount * 2;
    data[i] = clampByte(data[i] + noise);
    data[i + 1] = clampByte(data[i + 1] + noise);
    data[i + 2] = clampByte(data[i + 2] + noise);
  }
}

function applyPixelate(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  block: number,
): void {
  const copy = new Uint8ClampedArray(data);
  for (let y = 0; y < height; y += block) {
    for (let x = 0; x < width; x += block) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let by = 0; by < block && y + by < height; by += 1) {
        for (let bx = 0; bx < block && x + bx < width; bx += 1) {
          const index = ((y + by) * width + (x + bx)) * 4;
          r += copy[index];
          g += copy[index + 1];
          b += copy[index + 2];
          a += copy[index + 3];
          count += 1;
        }
      }
      if (count === 0) continue;
      r /= count;
      g /= count;
      b /= count;
      a /= count;
      for (let by = 0; by < block && y + by < height; by += 1) {
        for (let bx = 0; bx < block && x + bx < width; bx += 1) {
          const index = ((y + by) * width + (x + bx)) * 4;
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = a;
        }
      }
    }
  }
}

function applyPosterize(data: Uint8ClampedArray, levels: number): void {
  const step = 255 / Math.max(1, levels - 1);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(data[i] / step) * step;
    data[i + 1] = Math.round(data[i + 1] / step) * step;
    data[i + 2] = Math.round(data[i + 2] / step) * step;
  }
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
