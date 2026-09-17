import { getMediaUrl } from '../model/media';
import type { MediaAsset } from '../model/types';

/**
 * 图片解码缓存：同一 mediaId 只解码一次，解码完成后回调通知重绘。
 * element → node 渲染时若图片尚未就绪，先用空占位，待 onload 后 patchImage 替换。
 */

const images = new Map<string, HTMLImageElement>();
const failed = new Set<string>();

export function getCachedImage(asset: MediaAsset): HTMLImageElement | undefined {
  if (failed.has(asset.id)) return undefined;
  const cached = images.get(asset.id);
  if (cached) return cached;
  const url = getMediaUrl(asset);
  if (!url) return undefined;
  const image = new Image();
  image.onload = () => {
    images.set(asset.id, image);
  };
  image.onerror = () => {
    failed.add(asset.id);
  };
  image.src = url;
  if (image.complete && image.naturalWidth > 0) {
    images.set(asset.id, image);
    return image;
  }
  return undefined;
}

/** 供 Konva.Image 使用：返回已解码图片，并注册解码完成回调 */
export function acquireImage(asset: MediaAsset, onReady: () => void): HTMLImageElement | undefined {
  const cached = getCachedImage(asset);
  if (cached) return cached;
  const url = getMediaUrl(asset);
  if (!url) return undefined;
  const image = new Image();
  image.onload = () => {
    images.set(asset.id, image);
    onReady();
  };
  image.onerror = () => {
    failed.add(asset.id);
    onReady();
  };
  image.src = url;
  return undefined;
}

export function markReady(assetId: string, image: HTMLImageElement): void {
  images.set(assetId, image);
}

export function clearImageCache(): void {
  images.clear();
  failed.clear();
}
