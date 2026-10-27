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
 * The pixel pass (single implementation).
 *
 * Why a separate module: the same per-pixel pipeline has **three callers** — the synchronous preview
 * (`render/filters.ts`), the Web Worker async bake (`workers/bake.worker.ts`), and unit tests.
 * Separate copies would inevitably drift into "preview and export differ in color", and this module must stay **DOM-free**
 * (no Canvas / document imports), otherwise importing it inside the Worker crashes outright.
 */

export function applyPixelPassToData(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  adjustments: Adjustments,
  filters: FilterSpec[],
): void {
  // 1. Base adjustments (temperature / sharpen)
  if (adjustments.temperature !== 0) applyTemperature(data, adjustments.temperature);
  if (adjustments.sharpen > 0) {
    applyConvolution(width, height, data, SHARPEN_KERNEL, 1, 0, adjustments.sharpen / 100);
  }

  // 2. Extended adjustments (same order as documented: levels → curves → color balance → black & white → threshold → gradient map → desaturate)
  applyAdjustLuts(data, adjustments);
  if (adjustments.colorBalance) applyColorBalance(data, adjustments.colorBalance);
  if (adjustments.blackWhite) applyBlackWhite(data, adjustments.blackWhite);
  if (adjustments.threshold !== null && adjustments.threshold !== undefined) {
    applyThreshold(data, adjustments.threshold);
  }
  if (adjustments.gradientMap) applyGradientMap(data, adjustments.gradientMap.stops);
  if (adjustments.desaturate) applyDesaturate(data);

  // 2.5 Further adjustments (same order as documented in `model/types.ts`)
  if (adjustments.photoFilter) applyPhotoFilter(data, adjustments.photoFilter);
  if (adjustments.channelMixer) applyChannelMixer(data, adjustments.channelMixer);
  if (adjustments.shadowsHighlights) applyShadowsHighlights(data, adjustments.shadowsHighlights);
  if (adjustments.selectiveColor) applySelectiveColor(data, adjustments.selectiveColor);
  if (adjustments.replaceColor) applyReplaceColor(data, adjustments.replaceColor);

  // 3. Pixel-level filters (applied in array order)
  applyFilterSpecs(width, height, data, filters);
}

/** Temperature: positive is warmer (raise R, lower B), negative is cooler */
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
