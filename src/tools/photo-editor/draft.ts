import { assetToDataUrl, dataUrlToCanvas, getCanvas, registerCanvas } from './model/assets';
import { migrateDoc } from './model/migrate';
import type { PhotoDoc } from './model/types';

/**
 * 本地草稿（不离开浏览器）。
 *
 * 与 slide-editor 的降级策略一致：像素总量超过 `DRAFT_MEDIA_LIMIT` 时只保存结构、
 * 丢弃像素（恢复时这些图层是空白占位，UI 会给出提示），避免撑爆 localStorage。
 *
 * v2：草稿里现在还可能包含**编组 / 调整图层 / 智能对象**与**图层蒙版**，
 * 因此蒙版像素同样参与编码与预算；读取时统一走 `migrateDoc` 归一（兼容旧草稿）。
 */

/**
 * 沿用 v1 的键名：结构向后兼容（新字段均可缺省），
 * 换键会让用户未保存的旧草稿直接消失，代价大于收益。
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

type SerializedLayer = Record<string, unknown> & { data?: string; maskData?: string };

/** 该图层要内联的像素：位图 / 智能对象源 → data，蒙版 → maskData */
function encodeLayer(layer: PhotoDoc['layers'][number]): {
  data: string | null;
  maskData: string | null;
  bytes: number;
} {
  const sourceId =
    layer.kind === 'raster' ? layer.assetId : layer.kind === 'smart' ? layer.sourceAssetId : null;
  const data = sourceId && getCanvas(sourceId) ? assetToDataUrl(sourceId, 'image/png') : null;
  const maskData =
    layer.mask?.assetId && getCanvas(layer.mask.assetId)
      ? assetToDataUrl(layer.mask.assetId, 'image/png')
      : null;
  return {
    data,
    maskData,
    bytes: (data?.length ?? 0) + (maskData?.length ?? 0),
  };
}

export function writeDraft(doc: PhotoDoc): boolean {
  // 先编码再量体：超出预算就整体丢弃像素，保证 localStorage 不被撑爆
  const encoded = doc.layers.map((layer) => ({ layer, ...encodeLayer(layer) }));
  const bytes = encoded.reduce((sum, item) => sum + item.bytes, 0);
  const keepPixels = bytes <= DRAFT_BUDGET;

  const layers = encoded.map(({ layer, data, maskData }) => {
    const withMask =
      keepPixels && maskData && layer.mask
        ? { ...layer, mask: { ...layer.mask }, maskData }
        : layer.mask
          ? // 像素被丢弃或编码失败：蒙版降级为「无蒙版」，结构仍完整
            { ...layer, mask: null }
          : layer;
    if (!keepPixels || !data) {
      // 丢弃像素：位图 / 智能对象回到空 assetId
      return layer.kind === 'smart'
        ? { ...withMask, sourceAssetId: '' }
        : layer.kind === 'raster'
          ? { ...withMask, assetId: '' }
          : withMask;
    }
    return { ...withMask, data };
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
    const { data, maskData, ...rest } = layer;
    let next: Record<string, unknown> = rest;

    if (typeof data === 'string') {
      const canvas = await dataUrlToCanvas(data).catch(() => null);
      next =
        rest.kind === 'smart'
          ? { ...next, sourceAssetId: canvas ? registerCanvas(canvas) : '' }
          : { ...next, assetId: canvas ? registerCanvas(canvas) : '' };
    }
    if (typeof maskData === 'string' && next.mask && typeof next.mask === 'object') {
      const canvas = await dataUrlToCanvas(maskData).catch(() => null);
      if (canvas) {
        next = { ...next, mask: { ...(next.mask as object), assetId: registerCanvas(canvas) } };
      }
    }
    layers.push(next);
  }

  const doc = migrateDoc({ ...parsed.doc, layers });
  if (!doc) return null;
  return {
    doc,
    savedAt: parsed.savedAt ?? Date.now(),
    degraded: parsed.degraded === true,
  };
}
