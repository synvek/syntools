import { activeFilters, buildAdjustLuts, filterParam } from '../core';
import {
  applyClouds,
  applyFindEdges,
  applyLensFlare,
  applyPinch,
  applyReduceNoise,
  applySpherize,
  applyTraceContour,
  applyTwirl,
} from './filterExtra';
import type {
  Adjustments,
  BlackWhiteParams,
  ColorBalanceParams,
  FilterSpec,
  GradientStop,
} from '../model/types';

/**
 * 逐像素调整 / 滤镜运算（在 `render/filters.ts` 的像素通道里调用）。
 *
 * 分工：
 * - **可分离**的调整（色阶 / 曲线）合成每通道 LUT，一次查表完成；
 * - **跨通道 / 依赖亮度**的调整（色彩平衡、黑白、阈值、渐变映射、去色）逐像素处理；
 * - 滤镜（锐化 / USM / 动感模糊 / 浮雕 / 边缘 / 噪点 / 像素化 / 色调分离）按需卷积或扫描。
 */

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

function luminance(r: number, g: number, b: number): number {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

/** 色阶 + 曲线：每通道 LUT 一次查表 */
export function applyAdjustLuts(data: Uint8ClampedArray, adjustments: Adjustments): void {
  const luts = buildAdjustLuts(adjustments);
  if (!luts) return;
  const { r, g, b } = luts;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r[data[i]];
    data[i + 1] = g[data[i + 1]];
    data[i + 2] = b[data[i + 2]];
  }
}

/** 色彩平衡：按亮度落在阴影 / 中间调 / 高光的权重，对三条颜色轴做偏移 */
export function applyColorBalance(data: Uint8ClampedArray, params: ColorBalanceParams): void {
  const shadows = params.shadows ?? [0, 0, 0];
  const midtones = params.midtones ?? [0, 0, 0];
  const highlights = params.highlights ?? [0, 0, 0];
  if ([...shadows, ...midtones, ...highlights].every((value) => value === 0)) return;

  for (let i = 0; i < data.length; i += 4) {
    const lum = luminance(data[i], data[i + 1], data[i + 2]) / 255;
    // 三个区间的高斯权重（峰值分别在 0 / 0.5 / 1）
    const wShadow = Math.max(0, 1 - lum * 2);
    const wHighlight = Math.max(0, lum * 2 - 1);
    const wMid = 1 - wShadow - wHighlight;
    const shift = [0, 0, 0];
    for (let axis = 0; axis < 3; axis += 1) {
      shift[axis] =
        (shadows[axis] ?? 0) * wShadow +
        (midtones[axis] ?? 0) * wMid +
        (highlights[axis] ?? 0) * wHighlight;
    }
    // 轴 0：青-红；轴 1：洋红-绿；轴 2：黄-蓝
    const factor = 1.2;
    data[i] = clampByte(data[i] + shift[0] * factor);
    data[i + 1] = clampByte(data[i + 1] - shift[1] * factor);
    data[i + 2] = clampByte(data[i + 2] - shift[2] * factor);
  }
}

/** 黑白：按六色权重混合成灰度 */
export function applyBlackWhite(data: Uint8ClampedArray, params: BlackWhiteParams): void {
  const weights: Record<string, number> = {
    red: params.red ?? 0,
    yellow: params.yellow ?? 0,
    green: params.green ?? 0,
    cyan: params.cyan ?? 0,
    blue: params.blue ?? 0,
    magenta: params.magenta ?? 0,
  };
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // 六色近似分解：基色通道直接取，间色取两通道最小值
    const red = r - Math.min(g, b);
    const yellow = Math.min(r, g) - b;
    const green = g - Math.min(r, b);
    const cyan = Math.min(g, b) - r;
    const blue = b - Math.min(r, g);
    const magenta = Math.min(r, b) - g;
    const gray =
      0.299 * r +
      0.587 * g +
      0.114 * b +
      (red * weights.red +
        yellow * weights.yellow +
        green * weights.green +
        cyan * weights.cyan +
        blue * weights.blue +
        magenta * weights.magenta) /
        100;
    const value = clampByte(gray);
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
}

/** 阈值：亮度高于阈值为白，否则为黑 */
export function applyThreshold(data: Uint8ClampedArray, level: number): void {
  const threshold = Math.min(255, Math.max(0, level));
  for (let i = 0; i < data.length; i += 4) {
    const value = luminance(data[i], data[i + 1], data[i + 2]) >= threshold ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
}

/** 解析 #RRGGBB → [r,g,b] */
function parseHex(hex: string): [number, number, number] {
  const value = hex.trim().replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [0, 0, 0];
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** 渐变映射：按亮度在色标上取色 */
export function applyGradientMap(data: Uint8ClampedArray, stops: GradientStop[]): void {
  if (stops.length === 0) return;
  const sorted = [...stops].sort((a, b) => a.pos - b.pos);
  const table = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i += 1) {
    const pos = i / 255;
    let lower = sorted[0];
    let upper = sorted[sorted.length - 1];
    for (let k = 0; k < sorted.length; k += 1) {
      if (sorted[k].pos <= pos) lower = sorted[k];
      if (sorted[k].pos >= pos) {
        upper = sorted[k];
        break;
      }
    }
    const span = upper.pos - lower.pos;
    const t = span <= 1e-6 ? 0 : (pos - lower.pos) / span;
    const from = parseHex(lower.color);
    const to = parseHex(upper.color);
    table[i * 3] = from[0] + (to[0] - from[0]) * t;
    table[i * 3 + 1] = from[1] + (to[1] - from[1]) * t;
    table[i * 3 + 2] = from[2] + (to[2] - from[2]) * t;
  }
  for (let i = 0; i < data.length; i += 4) {
    const index = Math.round(luminance(data[i], data[i + 1], data[i + 2]));
    data[i] = table[index * 3];
    data[i + 1] = table[index * 3 + 1];
    data[i + 2] = table[index * 3 + 2];
  }
}

/** 去色：降到灰度（等价于饱和度 -100，但更直接） */
export function applyDesaturate(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const value = clampByte(luminance(data[i], data[i + 1], data[i + 2]));
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
}

/** 3×3 卷积：`mix` 用于与原图混合 */
export function applyConvolution(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  kernel: number[],
  divisor: number,
  offset: number,
  mix: number,
): void {
  const copy = new Uint8ClampedArray(data);
  const amount = Math.max(0, Math.min(1, mix));
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
      data[index] = copy[index] + (r / divisor + offset - copy[index]) * amount;
      data[index + 1] = copy[index + 1] + (g / divisor + offset - copy[index + 1]) * amount;
      data[index + 2] = copy[index + 2] + (b / divisor + offset - copy[index + 2]) * amount;
    }
  }
}

export const SHARPEN_KERNEL = [0, -1, 0, -1, 5, -1, 0, -1, 0];
export const EMBOSS_KERNEL = [-2, -1, 0, -1, 1, 1, 0, 1, 2];
export const EDGE_KERNEL = [0, 1, 0, 1, -4, 1, 0, 1, 0];

/** USM 锐化：先模糊再按差值增强边缘 */
export function applyUnsharp(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  radius: number,
  amount: number,
): void {
  const blurred = new Uint8ClampedArray(data);
  boxBlur(width, height, blurred, Math.max(1, Math.round(radius)));
  const strength = amount / 100;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clampByte(data[i] + (data[i] - blurred[i]) * strength);
    data[i + 1] = clampByte(data[i + 1] + (data[i + 1] - blurred[i + 1]) * strength);
    data[i + 2] = clampByte(data[i + 2] + (data[i + 2] - blurred[i + 2]) * strength);
  }
}

/** 可分离盒式模糊（近似高斯），原地写回 */
export function boxBlur(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  radius: number,
): void {
  const temp = new Uint8ClampedArray(data);
  // 横向
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const px = Math.min(width - 1, Math.max(0, x + k));
        const index = (y * width + px) * 4;
        r += temp[index];
        g += temp[index + 1];
        b += temp[index + 2];
        a += temp[index + 3];
        count += 1;
      }
      const index = (y * width + x) * 4;
      data[index] = r / count;
      data[index + 1] = g / count;
      data[index + 2] = b / count;
      data[index + 3] = a / count;
    }
  }
  // 纵向
  const horizontal = new Uint8ClampedArray(data);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const py = Math.min(height - 1, Math.max(0, y + k));
        const index = (py * width + x) * 4;
        r += horizontal[index];
        g += horizontal[index + 1];
        b += horizontal[index + 2];
        a += horizontal[index + 3];
        count += 1;
      }
      const index = (y * width + x) * 4;
      data[index] = r / count;
      data[index + 1] = g / count;
      data[index + 2] = b / count;
      data[index + 3] = a / count;
    }
  }
}

/** 动感模糊：沿给定角度做等距平均 */
export function applyMotionBlur(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  angleDeg: number,
  distance: number,
): void {
  const copy = new Uint8ClampedArray(data);
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const steps = Math.max(1, Math.round(distance));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let s = -steps; s <= steps; s += 1) {
        const px = Math.min(width - 1, Math.max(0, Math.round(x + dx * s)));
        const py = Math.min(height - 1, Math.max(0, Math.round(y + dy * s)));
        const index = (py * width + px) * 4;
        r += copy[index];
        g += copy[index + 1];
        b += copy[index + 2];
        count += 1;
      }
      const index = (y * width + x) * 4;
      data[index] = r / count;
      data[index + 1] = g / count;
      data[index + 2] = b / count;
    }
  }
}

function applyNoise(data: Uint8ClampedArray, amount: number, mono: boolean): void {
  for (let i = 0; i < data.length; i += 4) {
    if (mono) {
      const noise = (Math.random() - 0.5) * amount * 2;
      data[i] = clampByte(data[i] + noise);
      data[i + 1] = clampByte(data[i + 1] + noise);
      data[i + 2] = clampByte(data[i + 2] + noise);
    } else {
      data[i] = clampByte(data[i] + (Math.random() - 0.5) * amount * 2);
      data[i + 1] = clampByte(data[i + 1] + (Math.random() - 0.5) * amount * 2);
      data[i + 2] = clampByte(data[i + 2] + (Math.random() - 0.5) * amount * 2);
    }
  }
}

function applyPixelate(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  block: number,
): void {
  const size = Math.max(2, Math.round(block));
  const copy = new Uint8ClampedArray(data);
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let by = 0; by < size && y + by < height; by += 1) {
        for (let bx = 0; bx < size && x + bx < width; bx += 1) {
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
      for (let by = 0; by < size && y + by < height; by += 1) {
        for (let bx = 0; bx < size && x + bx < width; bx += 1) {
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
  const count = Math.max(2, Math.round(levels));
  const step = 255 / (count - 1);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(data[i] / step) * step;
    data[i + 1] = Math.round(data[i + 1] / step) * step;
    data[i + 2] = Math.round(data[i + 2] / step) * step;
  }
}

/** 应用全部像素级滤镜（顺序即数组顺序；已停用的滤镜自动跳过） */
export function applyFilterSpecs(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  filters: FilterSpec[],
): void {
  for (const spec of activeFilters(filters)) {
    switch (spec.id) {
      case 'sharpen':
        applyConvolution(
          width,
          height,
          data,
          SHARPEN_KERNEL,
          1,
          0,
          filterParam(spec, 'amount') / 100,
        );
        break;
      case 'unsharp':
        applyUnsharp(width, height, data, filterParam(spec, 'radius'), filterParam(spec, 'amount'));
        break;
      case 'motionBlur':
        applyMotionBlur(
          width,
          height,
          data,
          filterParam(spec, 'angle'),
          filterParam(spec, 'distance'),
        );
        break;
      case 'emboss':
        applyConvolution(
          width,
          height,
          data,
          EMBOSS_KERNEL,
          1,
          128,
          filterParam(spec, 'amount') / 100,
        );
        break;
      case 'edge':
        applyConvolution(width, height, data, EDGE_KERNEL, 1, 128, 1);
        break;
      case 'noise':
        applyNoise(data, filterParam(spec, 'amount'), filterParam(spec, 'mono') >= 0.5);
        break;
      case 'pixelate':
        applyPixelate(width, height, data, filterParam(spec, 'block'));
        break;
      case 'posterize':
        applyPosterize(data, filterParam(spec, 'levels'));
        break;
      // 扩展滤镜（扭曲 / 风格化 / 渲染 / 降噪）：实现见 `render/filterExtra.ts`
      case 'twirl':
        applyTwirl(width, height, data, filterParam(spec, 'angle'));
        break;
      case 'spherize':
        applySpherize(width, height, data, filterParam(spec, 'amount'));
        break;
      case 'pinch':
        applyPinch(width, height, data, filterParam(spec, 'amount'));
        break;
      case 'findEdges':
        applyFindEdges(width, height, data);
        break;
      case 'traceContour':
        applyTraceContour(width, height, data, filterParam(spec, 'level'));
        break;
      case 'clouds':
        applyClouds(width, height, data, filterParam(spec, 'amount'), filterParam(spec, 'size'));
        break;
      case 'lensFlare':
        applyLensFlare(
          width,
          height,
          data,
          filterParam(spec, 'amount'),
          filterParam(spec, 'size'),
          filterParam(spec, 'x'),
          filterParam(spec, 'y'),
        );
        break;
      case 'reduceNoise':
        applyReduceNoise(
          width,
          height,
          data,
          filterParam(spec, 'amount'),
          filterParam(spec, 'radius'),
        );
        break;
      default:
        break;
    }
  }
}
