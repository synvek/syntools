import { assetToDataUrl, dataUrlToCanvas, getCanvas, registerCanvas } from './model/assets';
import { migrateDoc } from './model/migrate';
import type { PhotoDoc } from './model/types';

/**
 * Local draft (never leaves the browser).
 *
 * Same degradation policy as slide-editor: past `DRAFT_MEDIA_LIMIT` total pixels, keep structure only,
 * drop pixels (restored as blank placeholders, with a UI notice), keeping localStorage from blowing up.
 *
 * v2: drafts may now contain **groups / adjustment layers / smart objects** and **layer masks**,
 * so mask pixels count toward encoding and the budget; reads normalize through `migrateDoc`.
 */

/**
 * The v1 key is kept: the structure is backward compatible (new fields are optional),
 * and changing it would silently lose users' unsaved drafts — a bad trade.
 */
const DRAFT_KEY = 'syntools:photo-editor.draft.v1';
/**
 * Draft budget: measured on the **encoded** (PNG dataURL) size, not on raw pixels.
 * A blank layer is megabytes raw (3.7MB at 1280×720) but only a few KB as PNG;
 * estimating from pixels would call nearly every draft too big, dropping pixels and leaving it unpaintable.
 */
const DRAFT_BUDGET = 4 * 1024 * 1024; // 4MB (localStorage's usual 5MB quota)

export interface PhotoDraft {
  doc: PhotoDoc;
  savedAt: number;
  /** True when pixels were dropped: the structure survives but the layer content is empty */
  degraded: boolean;
}

type SerializedLayer = Record<string, unknown> & { data?: string; maskData?: string };

/** Pixels to inline for this layer: bitmap / smart object source → data, mask → maskData */
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
  // Encode first, then measure: over budget means dropping all pixels so localStorage survives
  const encoded = doc.layers.map((layer) => ({ layer, ...encodeLayer(layer) }));
  const bytes = encoded.reduce((sum, item) => sum + item.bytes, 0);
  const keepPixels = bytes <= DRAFT_BUDGET;

  const layers = encoded.map(({ layer, data, maskData }) => {
    const withMask =
      keepPixels && maskData && layer.mask
        ? { ...layer, mask: { ...layer.mask }, maskData }
        : layer.mask
          ? // Pixels dropped or encoding failed: the mask degrades to "no mask", structure intact
            { ...layer, mask: null }
          : layer;
    if (!keepPixels || !data) {
      // Pixels dropped: bitmap / smart object fall back to an empty assetId
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
    // Fail silently when localStorage is unavailable or out of quota
    return false;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore
  }
}

/** Read the draft: it must decode the inlined dataURLs, hence async */
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
