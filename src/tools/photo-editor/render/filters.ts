import { activeFilters, buildFilterString, filterParam, needsPixelPass } from '../core';
import { previewScaleFor, scaleFilterParams } from './bakePlan';
import { scheduleFullResBake } from './bakeQueue';
import { applyPixelPassToData } from './pixelPass';
import type { Adjustments, FilterSpec } from '../model/types';

/**
 * 调整 / 滤镜烘焙管线。
 *
 * 预览与导出共用同一条管线，保证「所见即所得」：
 * 1. 先用 Canvas2D 的 `ctx.filter` 应用 CSS 能表达的部分（亮度 / 对比度 / 饱和度 / 色相 / 模糊 / 灰度 / 复古 / 反相）；
 * 2. 再用 ImageData 通道处理需要逐像素运算的部分：
 *    - 调整：色阶 / 曲线（每通道 LUT）、色彩平衡、黑白、阈值、渐变映射、去色、色温、锐化；
 *    - 滤镜：锐化 / USM / 动感模糊 / 浮雕 / 边缘 / 噪点 / 像素化 / 色调分离（参数来自 `FilterSpec.params`）。
 *
 * 结果按参数签名缓存：拖动滑杆时不重复烘焙未变化的图层。
 */

const CACHE_LIMIT = 24;
const cache = new Map<string, HTMLCanvasElement>();

export function clearBakeCache(): void {
  cache.clear();
}

/** 是否真的需要烘焙（无调整 / 无滤镜时可直接显示源画布） */
function needsBake(adjustments: Adjustments, filters: FilterSpec[]): boolean {
  return (
    Boolean([...cssParts(adjustments), ...filterParts(filters)].join(' ')) ||
    needsPixelPass(adjustments, filters)
  );
}

export function bakeRaster(
  source: HTMLCanvasElement,
  signature: string,
  adjustments: Adjustments,
  filters: FilterSpec[],
): HTMLCanvasElement {
  const cached = cache.get(signature);
  if (cached) return cached;
  const out = renderBake(source, adjustments, filters);

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(signature, out);
  return out;
}

/**
 * 落笔过程中的实时烘焙：像素每帧都在变，签名却不变，
 * 因此必须**绕过缓存**重画一次，否则画面要等到松手（rev 自增）才更新。
 * 无调整 / 无滤镜时直接返回源画布，零拷贝。
 */
export function bakeRasterLive(
  source: HTMLCanvasElement,
  adjustments: Adjustments,
  filters: FilterSpec[],
  signature = '',
): HTMLCanvasElement {
  if (!needsBake(adjustments, filters)) return source;
  const scale = previewScaleFor(source.width, source.height);
  if (scale < 1 && signature && !cache.has(signature)) {
    // 预览先给降采样结果（跟手），停手后由 Worker 补一份全分辨率写回缓存
    scheduleFullResBake({ signature, source, adjustments, filters });
  }
  return renderBake(source, adjustments, filters, scale);
}

function renderBake(
  source: HTMLCanvasElement,
  adjustments: Adjustments,
  filters: FilterSpec[],
  scale = 1,
): HTMLCanvasElement {
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const needsPixels = needsPixelPass(adjustments, filters);
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d', { willReadFrequently: needsPixels });
  if (!ctx) return source;

  const cssFilter = cssFilterOf(adjustments, filters, scale);
  if (cssFilter) ctx.filter = cssFilter;
  ctx.drawImage(source, 0, 0, width, height);
  ctx.filter = 'none';

  if (needsPixels) {
    const frame = ctx.getImageData(0, 0, width, height);
    // 预览降采样时，半径类参数必须等比缩小，否则松手瞬间画面会跳
    applyPixelPassToData(width, height, frame.data, adjustments, scaleFilterParams(filters, scale));
    ctx.putImageData(frame, 0, 0);
  }
  return out;
}

/**
 * CSS 能表达的滤镜串（Worker 里要拼同一份，因此单独暴露）。
 * `scale` 只影响模糊半径：预览降采样时半径必须同比缩小，否则「半径 8 的 0.5 倍预览」看起来等于全分辨率的半径 16。
 */
export function cssFilterOf(adjustments: Adjustments, filters: FilterSpec[], scale = 1): string {
  return [...cssParts(adjustments), ...filterParts(filters, scale)].join(' ');
}

/** 把 Worker 算好的全分辨率结果写入缓存：下次同签名直接命中 */
export function putBakeResult(signature: string, canvas: HTMLCanvasElement): void {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(signature, canvas);
}

function cssParts(adjustments: Adjustments): string[] {
  const parts = buildFilterString(adjustments);
  return parts ? [parts] : [];
}

/** CSS filter 能表达的滤镜部分（只取启用中的滤镜）；`scale` 用于预览降采样时等比缩小模糊半径 */
function filterParts(filters: FilterSpec[], scale = 1): string[] {
  const parts: string[] = [];
  for (const spec of activeFilters(filters)) {
    switch (spec.id) {
      case 'grayscale':
        parts.push('grayscale(1)');
        break;
      case 'sepia':
        parts.push('sepia(1)');
        break;
      case 'invert':
        parts.push('invert(1)');
        break;
      case 'blur':
      case 'gaussianBlur': {
        const radius = Math.max(0, filterParam(spec, 'radius') * scale);
        if (radius > 0) parts.push(`blur(${radius}px)`);
        break;
      }
      default:
        break;
    }
  }
  return parts;
}
