import { assetToDataUrl, dataUrlToCanvas, getCanvas, registerCanvas } from './model/assets';
import type { PhotoDoc } from './model/types';

/**
 * 本地草稿（不离开浏览器）。
 *
 * 与 slide-editor 的降级策略一致：像素总量超过 `DRAFT_MEDIA_LIMIT` 时只保存结构、
 * 丢弃像素（恢复时这些图层是空白占位，UI 会给出提示），避免撑爆 localStorage。
 */

const DRAFT_KEY = 'syntools:photo-editor.draft.v1';
/**
 * 草稿预算：按 **编码后（PNG dataURL）** 的体量计，而不是原始像素。
 * 空白图层原始像素动辄数 MB（1280×720 就有 3.7MB），但压成 PNG 只有几 KB；
 * 用像素估算会让几乎所有草稿都被判定为「过大」而丢掉像素，恢复后就画不了。
 */
const DRAFT_BUDGET = 4 * 1024 * 1024; // 4MB（localStorage 常见配额 5MB）

export interface PhotoDraft {
  doc: PhotoDoc;
  savedAt: number;
  /** 像素被丢弃时为 true：结构还在，但图层内容为空 */
  degraded: boolean;
}

type SerializedLayer = Record<string, unknown> & { data?: string };

export function writeDraft(doc: PhotoDoc): boolean {
  // 先编码再量体：超出预算就整体丢弃像素，保证 localStorage 不被撑爆
  const encoded = doc.layers.map((layer) => {
    if (layer.kind !== 'raster') return { layer, data: null as string | null };
    const url = getCanvas(layer.assetId) ? assetToDataUrl(layer.assetId, 'image/png') : null;
    return { layer, data: url };
  });
  const bytes = encoded.reduce((sum, item) => sum + (item.data ? item.data.length : 0), 0);
  const keepPixels = bytes <= DRAFT_BUDGET;
  const layers = encoded.map(({ layer, data }) => {
    if (layer.kind !== 'raster') return layer;
    if (!keepPixels || !data) return { ...layer, assetId: '' };
    return { ...layer, data };
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
