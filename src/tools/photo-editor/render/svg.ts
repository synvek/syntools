/**
 * SVG 导入。
 *
 * 定位很明确：**栅格化导入**（不是「把 SVG 解析成矢量图层」）。
 * 我们的文档模型是位图优先的，真正需要的是「把这张矢量图按我想要的清晰度变成像素」；
 * 而 SVG 恰恰是可缩放的，所以关键在两点：
 *
 * 1. **算出它的固有尺寸** —— 读 `width` / `height`（含 px / pt / cm 等单位换算），缺失时退回 `viewBox`；
 * 2. **按倍数超采样** —— 默认 2 倍，这样导入后再缩放图层不会立刻糊掉（上限 `MAX_CANVAS_SIZE`）。
 *
 * 安全上只经 `<img>` 渲染：浏览器在这种模式下**不执行** SVG 内的脚本、也不加载外部资源
 * （因此不存在外链请求与脚本注入面），失败就回落到「无法导入」。
 */

import type { ToolResult } from '@/core/types';
import { MAX_CANVAS_SIZE } from '../core';
import { createCanvasElement, registerCanvas, type LoadedImage } from '../model/assets';

/** 导入时的默认超采样倍数 */
export const SVG_DEFAULT_SCALE = 2;

/** CSS 的绝对单位 → 像素换算（1in = 96px） */
const UNIT_TO_PX: Record<string, number> = {
  '': 1,
  px: 1,
  pt: 96 / 72,
  pc: 16,
  mm: 96 / 25.4,
  cm: 96 / 2.54,
  in: 96,
  q: 96 / 101.6,
};

export interface SvgSize {
  width: number;
  height: number;
}

/**
 * 从一个 CSS 长度值解析出像素数；`%` / `auto` / `em` 这类依赖上下文的长度返回 null。
 * 允许负数？不允许 —— 负尺寸的 SVG 没有意义，直接当解析失败。
 */
export function parseSvgLength(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*([a-z%]*)\s*$/i.exec(value);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const factor = UNIT_TO_PX[unit];
  if (factor === undefined) return null;
  return amount * factor;
}

/** `viewBox="minX minY width height"`（逗号或空白分隔）→ 宽高 */
export function parseViewBox(value: string | undefined): SvgSize | null {
  if (!value) return null;
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 4 || parts.some((item) => !Number.isFinite(item))) return null;
  const [, , width, height] = parts;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

/**
 * SVG 源码 → 固有尺寸。
 *
 * 用正则在 `<svg ...>` 开标签上取属性，而不是上 `DOMParser`：这段逻辑要能在纯函数层跑（含 prerender 环境），
 * 而 `width` / `height` / `viewBox` 这三个属性是纯文本形态，正则足够且失败模式可控（解析不出就返回 null）。
 * 优先级与浏览器一致：`width`+`height` 都有效时优先，否则用 `viewBox`。
 */
export function parseSvgIntrinsicSize(source: string): SvgSize | null {
  const tag = /<svg\b([^>]*)>/i.exec(source);
  if (!tag) return null;
  const attributes = new Map<string, string>();
  const attrPattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match = attrPattern.exec(tag[1]);
  while (match) {
    attributes.set(match[1], match[2] ?? match[3] ?? '');
    match = attrPattern.exec(tag[1]);
  }
  // 属性名按原样保留再忽略大小写查找：`viewBox` 是驼峰，直接小写化会把它找丢
  const read = (name: string) => {
    const target = name.toLowerCase();
    for (const [key, value] of attributes) {
      if (key.toLowerCase() === target) return value;
    }
    return undefined;
  };

  const width = parseSvgLength(read('width'));
  const height = parseSvgLength(read('height'));
  if (width !== null && height !== null) return { width, height };
  return parseViewBox(read('viewBox'));
}

/** 按倍数算出栅格化尺寸；未知固有尺寸时给一个保守的默认框，并整体钳制到画布上限 */
export function svgRasterSize(size: SvgSize | null, scale = SVG_DEFAULT_SCALE): SvgSize {
  const base = size ?? { width: 512, height: 512 };
  const factor = Math.max(1, scale);
  let width = Math.round(base.width * factor);
  let height = Math.round(base.height * factor);
  const longest = Math.max(width, height);
  if (longest > MAX_CANVAS_SIZE) {
    const shrink = MAX_CANVAS_SIZE / longest;
    width = Math.max(1, Math.round(width * shrink));
    height = Math.max(1, Math.round(height * shrink));
  }
  return { width, height };
}

/**
 * SVG 文本 → 画布。
 *
 * 用 Blob 重新包一次（而不是直接用原 File 的 object URL）：
 * 这样即使文件缺少 MIME（有些系统导出为空）也能强制按 `image/svg+xml` 解码。
 */
export function rasterizeSvg(
  source: string,
  scale = SVG_DEFAULT_SCALE,
): Promise<HTMLCanvasElement> {
  const raster = svgRasterSize(parseSvgIntrinsicSize(source), scale);
  const blob = new Blob([source], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = createCanvasElement(raster.width, raster.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('CONTEXT_FAILED'));
        return;
      }
      ctx.drawImage(image, 0, 0, raster.width, raster.height);
      resolve(canvas);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG_DECODE_FAILED'));
    };
    image.src = url;
  });
}

/** 读取本地 SVG 文件 → 资产 */
export async function loadSvgFile(
  file: File,
  scale = SVG_DEFAULT_SCALE,
): Promise<ToolResult<LoadedImage>> {
  try {
    const source = await file.text();
    const canvas = await rasterizeSvg(source, scale);
    return {
      ok: true,
      value: { assetId: registerCanvas(canvas), width: canvas.width, height: canvas.height },
    };
  } catch {
    return { ok: false, error: 'SVG_DECODE_FAILED' };
  }
}
