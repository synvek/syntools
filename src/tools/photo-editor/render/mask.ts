import { createCanvasElement, getCanvas, registerCanvas } from '../model/assets';
import type { MaskRef, Rect } from '../model/types';

/**
 * 图层蒙版：灰度画布（白 = 显示、黑 = 隐藏）。
 *
 * 蒙版像素同样放在资产注册表里（`MaskRef.assetId`），文档只存引用。
 * 这里负责三件事：
 * 1. 新建蒙版画布（全部显示 / 全部隐藏 / 按多边形裁剪）；
 * 2. 把蒙版按「羽化 → 浓度 → 反相」烘焙成可直接 `destination-in` 的 alpha 图；
 * 3. 把烘焙结果作用到目标画布上。
 *
 * 烘焙结果按 `maskSignature` 缓存——蒙版没变时不重复模糊（模糊是大图最贵的一步）。
 */

const cache = new Map<string, HTMLCanvasElement>();
const CACHE_LIMIT = 16;

export function createMaskCanvas(width: number, height: number, mode: 'show' | 'hide'): string {
  const canvas = createCanvasElement(
    Math.max(1, Math.round(width)),
    Math.max(1, Math.round(height)),
  );
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = mode === 'show' ? '#ffffff' : '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return registerCanvas(canvas);
}

/** 按多边形（选区轮廓）生成蒙版：轮廓内为白，其余为黑 */
export function createMaskCanvasFromPolygon(
  width: number,
  height: number,
  polygon: number[],
): string {
  const canvas = createCanvasElement(
    Math.max(1, Math.round(width)),
    Math.max(1, Math.round(height)),
  );
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (polygon.length >= 6) {
      ctx.beginPath();
      ctx.moveTo(polygon[0], polygon[1]);
      for (let i = 2; i + 1 < polygon.length; i += 2) ctx.lineTo(polygon[i], polygon[i + 1]);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }
  return registerCanvas(canvas);
}

/**
 * 把蒙版烘焙成 alpha 图。
 *
 * 关键点：`destination-in` 只看**源 alpha**，而蒙版画布是不透明的灰度图（黑也是 alpha=255），
 * 直接拿来当源等于「完全不裁」。所以这里把灰度转成 alpha：
 * `alpha = 亮度 × 浓度`，反相则在取亮度前先黑白互换。
 * 转换结果按 `maskSignature` 缓存——蒙版没变时不重复模糊与逐像素扫描。
 */
export function bakeMask(mask: MaskRef, signature: string): HTMLCanvasElement | null {
  const cached = cache.get(signature);
  if (cached) return cached;
  const source = getCanvas(mask.assetId);
  if (!source) return null;

  const out = createCanvasElement(source.width, source.height);
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.filter = mask.feather > 0 ? `blur(${Math.min(64, mask.feather)}px)` : 'none';
  if (mask.inverted) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.globalCompositeOperation = 'difference';
  }
  ctx.drawImage(source, 0, 0);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';

  // 亮度 → alpha（0.299/0.587/0.114 为 Rec.601 亮度权重）
  const image = ctx.getImageData(0, 0, out.width, out.height);
  const data = image.data;
  const density = Math.min(1, Math.max(0, mask.density));
  for (let i = 0; i < data.length; i += 4) {
    const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i + 3] = Math.round(luminance * density);
  }
  ctx.putImageData(image, 0, 0);

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(signature, out);
  return out;
}

/**
 * 把蒙版作用到目标画布：只保留蒙版为白的部分（`destination-in`）。
 * `rect` 为蒙版在目标画布上的落位（目标画布坐标系）。
 */
export function applyMask(
  target: HTMLCanvasElement,
  mask: MaskRef,
  signature: string,
  rect: Rect,
): void {
  const baked = bakeMask(mask, signature);
  const ctx = target.getContext('2d');
  if (!baked || !ctx) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(baked, rect.x, rect.y, Math.max(1, rect.width), Math.max(1, rect.height));
  ctx.restore();
}

/** 蒙版缩略图（面板展示）：白底灰图 */
export function maskThumbnail(mask: MaskRef, max = 44): string | null {
  const source = getCanvas(mask.assetId);
  if (!source) return null;
  const scale = Math.min(1, max / Math.max(source.width, source.height));
  const canvas = createCanvasElement(
    Math.max(1, Math.round(source.width * scale)),
    Math.max(1, Math.round(source.height * scale)),
  );
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}
