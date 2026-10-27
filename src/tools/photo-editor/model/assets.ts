import type { ToolResult } from '@/core/types';
import { createId } from './factory';

/**
 * Runtime registry for bitmap assets.
 *
 * Pixels never enter the document (it only stores an `assetId`), so:
 * - undo / redo copies references only, never deep-copies pixels;
 * - an asset can be shared by several layers (duplicated layers);
 * - `releaseExcept` reclaims unreferenced canvases when history is trimmed / the document is replaced, avoiding leaks.
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

/** Copy an asset (for layer duplication): returns the new assetId */
export function cloneAsset(id: string): string | null {
  const source = registry.get(id);
  if (!source) return null;
  const copy = createCanvasElement(source.width, source.height);
  const ctx = copy.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0);
  return registerCanvas(copy);
}

/** Release assets no layer references */
export function releaseExcept(usedIds: Set<string>): void {
  for (const id of [...registry.keys()]) {
    if (usedIds.has(id)) continue;
    const canvas = registry.get(id);
    if (!canvas) continue;
    // Zero the dimensions explicitly so the browser reclaims the backing store early
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

/** Estimate the memory held by all assets (shown in the status bar) */
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

/** Read a local image file → asset (no upload, all in the browser) */
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

/**
 * Collect every asset id the document currently references (for releaseExcept).
 *
 * Besides the bitmaps themselves this must include **mask canvases** and **smart-object source pixels**,
 * otherwise a single `releaseExcept` (fired by undo / redo / layer deletion) would reclaim masks to blank.
 */
export function collectUsedAssets(
  layers: {
    kind: string;
    assetId?: string;
    sourceAssetId?: string;
    mask?: { assetId?: string } | null;
  }[],
): Set<string> {
  const used = new Set<string>();
  for (const layer of layers) {
    if (layer.kind === 'raster' && layer.assetId) used.add(layer.assetId);
    if (layer.kind === 'smart' && layer.sourceAssetId) used.add(layer.sourceAssetId);
    if (layer.mask?.assetId) used.add(layer.mask.assetId);
  }
  return used;
}
