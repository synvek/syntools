import { getMediaUrl } from '../model/media';
import type { MediaAsset } from '../model/types';

/**
 * Image decode cache: each mediaId is decoded once, and callbacks trigger a redraw when decoding finishes.
 * When rendering element → node, an undecoded image shows an empty placeholder and is swapped via patchImage on load.
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

/** For Konva.Image: return the decoded image and register a decode-complete callback */
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
