import type { ToolResult } from '@/core/types';
import { createId } from './factory';

/**
 * 位图资产运行时注册表。
 *
 * 像素不进文档（文档只存 `assetId`），因此：
 * - 撤销 / 重做只复制引用，不做像素深拷贝；
 * - 资产可被多个图层共享（复制图层）；
 * - `releaseExcept` 在历史被裁剪 / 文档被替换时回收无引用画布，避免内存泄漏。
 */

const registry = new Map<string, HTMLCanvasElement>();

export function createCanvasElement(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function registerCanvas(canvas: HTMLCanvasElement): string {
  const id = createId('asset');
  registry.set(id, canvas);
  return id;
}

export function registerCanvasWithId(id: string, canvas: HTMLCanvasElement): void {
  registry.set(id, canvas);
}

export function getCanvas(id: string | undefined): HTMLCanvasElement | undefined {
  if (!id) return undefined;
  return registry.get(id);
}

export function createBlankAsset(width: number, height: number): string {
  return registerCanvas(createCanvasElement(width, height));
}

/** 复制资产（复制图层用）：返回新 assetId */
export function cloneAsset(id: string): string | null {
  const source = registry.get(id);
  if (!source) return null;
  const copy = createCanvasElement(source.width, source.height);
  const ctx = copy.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0);
  return registerCanvas(copy);
}

/** 释放未被任何图层引用的资产 */
export function releaseExcept(usedIds: Set<string>): void {
  for (const id of [...registry.keys()]) {
    if (usedIds.has(id)) continue;
    const canvas = registry.get(id);
    if (!canvas) continue;
    // 显式清零尺寸，提示浏览器尽早回收 backing store
    canvas.width = 0;
    canvas.height = 0;
    registry.delete(id);
  }
}

export function clearAssets(): void {
  for (const canvas of registry.values()) {
    canvas.width = 0;
    canvas.height = 0;
  }
  registry.clear();
}

export function assetCount(): number {
  return registry.size;
}

/** 估算全部资产占用内存（状态栏展示用） */
export function estimateMemoryBytes(): number {
  let total = 0;
  for (const canvas of registry.values()) total += canvas.width * canvas.height * 4;
  return total;
}

export function assetToDataUrl(id: string, mime = 'image/png', quality?: number): string | null {
  const canvas = registry.get(id);
  if (!canvas) return null;
  return canvas.toDataURL(mime, quality);
}

export function dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = createCanvasElement(image.naturalWidth, image.naturalHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('CONTEXT_FAILED'));
        return;
      }
      ctx.drawImage(image, 0, 0);
      resolve(canvas);
    };
    image.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
    image.src = dataUrl;
  });
}

export interface LoadedImage {
  assetId: string;
  width: number;
  height: number;
}

/** 读取本地图片文件 → 资产（不上传，全程在浏览器内） */
export async function loadImageFile(file: File): Promise<ToolResult<LoadedImage>> {
  try {
    const buffer = await file.arrayBuffer();
    const blob = new Blob([buffer], { type: file.type || 'image/png' });
    const url = URL.createObjectURL(blob);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
      element.src = url;
    });
    URL.revokeObjectURL(url);
    const width = image.naturalWidth || 1;
    const height = image.naturalHeight || 1;
    const canvas = createCanvasElement(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, error: 'IMAGE_DECODE_FAILED' };
    ctx.drawImage(image, 0, 0);
    return { ok: true, value: { assetId: registerCanvas(canvas), width, height } };
  } catch {
    return { ok: false, error: 'IMAGE_DECODE_FAILED' };
  }
}

/** 收集文档当前引用到的全部资产 id（供 releaseExcept 使用） */
export function collectUsedAssets(layers: { kind: string; assetId?: string }[]): Set<string> {
  const used = new Set<string>();
  for (const layer of layers) {
    if (layer.kind === 'raster' && layer.assetId) used.add(layer.assetId);
  }
  return used;
}
