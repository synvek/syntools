import {
  applyAdjustLuts,
  applyBlackWhite,
  applyColorBalance,
  applyConvolution,
  applyDesaturate,
  applyFilterSpecs,
  applyGradientMap,
  applyThreshold,
  SHARPEN_KERNEL,
} from './adjust';
import {
  applyChannelMixer,
  applyPhotoFilter,
  applyReplaceColor,
  applySelectiveColor,
  applyShadowsHighlights,
} from './adjustMore';
import type { Adjustments, FilterSpec } from '../model/types';

/**
 * 像素通道（唯一实现）。
 *
 * 为什么单独成模块：同一条逐像素管线有**三个调用方** —— 同步预览（`render/filters.ts`）、
 * Web Worker 异步烘焙（`workers/bake.worker.ts`）、以及单测。
 * 各写一份必然出现「预览与导出不同色」这类漂移，而且本模块必须保持 **DOM 无关**
 * （不引 Canvas / document），否则 Worker 里 import 就会直接崩。
 */

export function applyPixelPassToData(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  adjustments: Adjustments,
  filters: FilterSpec[],
): void {
  // 1. 基础调整（色温 / 锐化）
  if (adjustments.temperature !== 0) applyTemperature(data, adjustments.temperature);
  if (adjustments.sharpen > 0) {
    applyConvolution(width, height, data, SHARPEN_KERNEL, 1, 0, adjustments.sharpen / 100);
  }

  // 2. 扩展调整（顺序与文档一致：色阶→曲线→色彩平衡→黑白→阈值→渐变映射→去色）
  applyAdjustLuts(data, adjustments);
  if (adjustments.colorBalance) applyColorBalance(data, adjustments.colorBalance);
  if (adjustments.blackWhite) applyBlackWhite(data, adjustments.blackWhite);
  if (adjustments.threshold !== null && adjustments.threshold !== undefined) {
    applyThreshold(data, adjustments.threshold);
  }
  if (adjustments.gradientMap) applyGradientMap(data, adjustments.gradientMap.stops);
  if (adjustments.desaturate) applyDesaturate(data);

  // 2.5 更多调整（顺序与 `model/types.ts` 的文档一致）
  if (adjustments.photoFilter) applyPhotoFilter(data, adjustments.photoFilter);
  if (adjustments.channelMixer) applyChannelMixer(data, adjustments.channelMixer);
  if (adjustments.shadowsHighlights) applyShadowsHighlights(data, adjustments.shadowsHighlights);
  if (adjustments.selectiveColor) applySelectiveColor(data, adjustments.selectiveColor);
  if (adjustments.replaceColor) applyReplaceColor(data, adjustments.replaceColor);

  // 3. 像素级滤镜（按数组顺序叠加）
  applyFilterSpecs(width, height, data, filters);
}

/** 色温：正值偏暖（提 R 压 B），负值偏冷 */
function applyTemperature(data: Uint8ClampedArray, temperature: number): void {
  const shift = (temperature / 100) * 32;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clampByte(data[i] + shift);
    data[i + 2] = clampByte(data[i + 2] - shift);
  }
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
