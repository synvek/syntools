import { assetToDataUrl, dataUrlToCanvas, getCanvas, registerCanvas } from './model/assets';
import type { PhotoDoc } from './model/types';

/**
 * 本地草稿（不离开浏览器）。
 *
 * 与 slide-editor 的降级策略一致：像素总量超过 `DRAFT_MEDIA_LIMIT` 时只保存结构、
 * 丢弃像素（恢复时这些图层是空白占位，UI 会给出提示），避免撑爆 localStorage。
 */

const DRAFT_KEY = 'syntools:photo-editor.draft.v1';
const DRAFT_MEDIA_LIMIT = 3 * 1024 * 1024; // 3MB（按原始像素估算）

export interface PhotoDraft {
  doc: PhotoDoc;
  savedAt: number;
  /** 像素被丢弃时为 true：结构还在，但图层内容为空 */
  degraded: boolean;
}

type SerializedLayer = Record<string, unknown> & { data?: string };

export function writeDraft(doc: PhotoDoc): boolean {
  let total = 0;
  for (const layer of doc.layers) {
    if (layer.kind !== 'raster') continue;
    const canvas = getCanvas(layer.assetId);
    if (canvas) total += canvas.width * canvas.height * 4;
  }
  const keepPixels = total <= DRAFT_MEDIA_LIMIT;
  const layers = doc.layers.map((layer) => {
    if (layer.kind !== 'raster') return layer;
    if (!keepPixels) return { ...layer, assetId: '' };
    const url = assetToDataUrl(layer.assetId, 'image/png');
    return url ? { ...layer, data: url } : { ...layer, assetId: '' };
  });
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        doc: { ...doc, layers },
        savedAt: Date.now(),
        degraded: !keepPixels && doc.layers.length > 0,
      }),
    );
    return true;
  } catch {
    // localStorage 不可用或配额不足时静默失败
    return false;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // 忽略
  }
}

/** 读取草稿：需要解码内嵌的 dataURL，故为异步 */
export async function readDraft(): Promise<PhotoDraft | null> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: {
    doc?: PhotoDoc & { layers?: SerializedLayer[] };
    savedAt?: number;
    degraded?: boolean;
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return null;
  }
  if (!parsed.doc || !Array.isArray(parsed.doc.layers)) return null;

  const layers: Record<string, unknown>[] = [];
  for (const layer of parsed.doc.layers) {
    const { data, ...rest } = layer;
    if (rest.kind !== 'raster' || typeof data !== 'string') {
      layers.push(rest);
      continue;
    }
    const canvas = await dataUrlToCanvas(data).catch(() => null);
    layers.push({ ...rest, assetId: canvas ? registerCanvas(canvas) : '' });
  }

  return {
    doc: { ...parsed.doc, layers } as unknown as PhotoDoc,
    savedAt: parsed.savedAt ?? Date.now(),
    degraded: parsed.degraded === true,
  };
}
