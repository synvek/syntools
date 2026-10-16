import { activeFilters } from '../core';
import type { FilterId, FilterSpec } from '../model/types';

/**
 * 烘焙的性能策略（纯逻辑，可单测）。
 *
 * 三条决策都在这里，不掺任何 DOM：
 * 1. **预览降采样**：落笔 / 拖滑杆期间按更低分辨率烘焙（像素量按平方下降），静止后再走全分辨率；
 * 2. **滤镜参数随缩放等比**（`scaleFilterParams`）：半径类参数必须跟着缩放，
 *    否则「0.5 倍预览 + 半径 8」看起来等于「全分辨率 + 半径 4」，松手瞬间画面会跳；
 * 3. **是否值得交给 Worker**：像素量与滤镜代价的乘积超阈值才值得一次异步往返。
 */

/** 超过这个像素量，实时预览开始降采样（约 200 万像素 ≈ 1414²） */
const PREVIEW_PIXEL_BUDGET = 2_000_000;
/** 预览最低倍率：再低就看不清在画什么了 */
const MIN_PREVIEW_SCALE = 0.35;

/** 实时烘焙（live）时使用的分辨率倍率 */
export function previewScaleFor(width: number, height: number): number {
  const pixels = Math.max(1, width) * Math.max(1, height);
  if (pixels <= PREVIEW_PIXEL_BUDGET) return 1;
  const scale = Math.sqrt(PREVIEW_PIXEL_BUDGET / pixels);
  return Math.max(MIN_PREVIEW_SCALE, Math.round(scale * 100) / 100);
}

/**
 * 滤镜参数随缩放换算。
 *
 * 只缩放**长度量**（模糊半径 / 动感模糊距离 / 像素化块大小），角度与百分比不动。
 * `size` 参数在云彩里是「噪声尺度」（越大越平缓），随缩放换算后才能保持视觉一致 —— 因此也缩放。
 */
export function scaleFilterParams(filters: FilterSpec[], scale: number): FilterSpec[] {
  if (scale >= 0.999) return filters;
  const ratio = Math.max(0.05, scale);
  return filters.map((spec) => {
    if (!spec.params) return spec;
    const params: Record<string, number> = {};
    for (const [key, value] of Object.entries(spec.params)) {
      const isLength = key === 'radius' || key === 'distance' || key === 'size';
      const isBlock = key === 'block' && spec.id === 'pixelate';
      params[key] = isLength || isBlock ? Math.max(1, Math.round(value * ratio)) : value;
    }
    return { ...spec, params };
  });
}

/** 各类滤镜的相对代价（≈ 每像素的运算量级），用于判断是否值得异步 */
const FILTER_COST: Partial<Record<FilterId, number>> = {
  reduceNoise: 40,
  motionBlur: 12,
  unsharp: 8,
  gaussianBlur: 6,
  blur: 6,
  clouds: 10,
  twirl: 6,
  spherize: 6,
  pinch: 6,
  lensFlare: 4,
  findEdges: 4,
  traceContour: 4,
  emboss: 3,
  edge: 3,
  sharpen: 3,
  noise: 1,
  pixelate: 2,
  posterize: 1,
};

/** 估计的像素工作量（像素数 × 各滤镜代价之和） */
export function estimatePixelWork(width: number, height: number, filters: FilterSpec[]): number {
  const pixels = Math.max(1, width) * Math.max(1, height);
  let cost = 0;
  for (const spec of activeFilters(filters)) cost += FILTER_COST[spec.id] ?? 1;
  return pixels * Math.max(1, cost);
}

/** 超过这个工作量就值得交给 Worker（约 6000 万次像素运算） */
export const OFFLOAD_WORK_THRESHOLD = 60_000_000;

export function shouldOffloadPixels(width: number, height: number, filters: FilterSpec[]): boolean {
  return estimatePixelWork(width, height, filters) >= OFFLOAD_WORK_THRESHOLD;
}
