import { createCanvasElement } from '../model/assets';
import {
  NO_ADJUSTMENTS,
  bakeSignature,
  maskSignature,
  styleSignature,
  subtreeIdsOf,
  vectorMaskSignature,
} from '../core';
import { bakeRaster } from './filters';
import { clipBaseOf, layerNeedsComposite, paintLayer } from './paint';
import type { AdjustmentLayer, GroupLayer, Layer, PhotoDoc, Rect } from '../model/types';

/**
 * Offscreen compositing pipeline: groups (composited mode), masks and adjustment layers all compose here,
 * and canvas preview, image export and PSD export share the result, so what you see is what you get.
 *
 * Layers that need none of this still use Konva nodes from `render/nodes.ts` (crisp text, fast updates),
 * paying the offscreen cost only when layers genuinely have to be flattened into one image.
 */

export interface CompositeOptions {
  /** Composite only this region (document coordinates); defaults to the whole canvas */
  clip?: Rect | null;
  /** Output scale: 1 = full size, <1 for downsampled previews */
  scale?: number;
  /** Background fill; 'none' means transparent (used for in-group compositing) */
  background?: PhotoDoc['background'] | 'none';
  signaturePrefix?: string;
}

const BACKGROUND_COLOR: Record<PhotoDoc['background'], string> = {
  transparent: 'rgba(0,0,0,0)',
  white: '#ffffff',
  black: '#000000',
};

export function compositeLayers(
  doc: PhotoDoc,
  layers: Layer[],
  options: CompositeOptions = {},
): HTMLCanvasElement {
  const scale = options.scale ?? 1;
  const region = options.clip ?? { x: 0, y: 0, width: doc.width, height: doc.height };
  const canvas = createCanvasElement(region.width * scale, region.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  if (options.background && options.background !== 'none') {
    ctx.fillStyle = BACKGROUND_COLOR[options.background];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.translate(-region.x, -region.y);

  for (const layer of layers) {
    if (layer.kind === 'group') {
      // In pass-through mode children blend on their own and the caller (layer-stack walk) draws each
      if (layer.passThrough || !layer.visible) continue;
      if (!layerNeedsComposite(layer)) {
        // Fast path without mask / style: composite the whole group, then draw it with the group's settings
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.globalCompositeOperation = layer.blend === 'normal' ? 'source-over' : layer.blend;
        ctx.drawImage(groupComposite(doc, layer), 0, 0, doc.width, doc.height);
        ctx.restore();
        continue;
      }
      // With mask / layer style / clipping mask: use `paintLayer`'s composite path, matching the preview
      paintLayer(ctx, layer, {
        doc,
        signaturePrefix: options.signaturePrefix ?? 'composite',
        clipBase: clipBaseOf(doc, layer),
      });
      continue;
    }
    if (layer.kind === 'adjustment') {
      // Adjustment layer: acts on the composited content below — bake the whole canvas (CSS + pixel pass)
      if (!layer.visible) continue;
      applyAdjustment(canvas, ctx, layer, region, scale, options.signaturePrefix);
      continue;
    }
    paintLayer(ctx, layer, {
      doc,
      signaturePrefix: options.signaturePrefix ?? 'composite',
      clipBase: clipBaseOf(doc, layer),
    });
  }
  return canvas;
}

/**
 * Composite a group: flatten its subtree into one canvas (transparent background),
 * cached by signature so an unchanged subtree is reused instead of repainted every frame.
 */
export function groupComposite(doc: PhotoDoc, group: GroupLayer): HTMLCanvasElement {
  const key = groupCompositeKey(doc, group);
  const cached = groupCache.get(key);
  if (cached) return cached;
  const subtree = doc.layers.filter((layer) => subtreeIdsOf(doc, group.id).includes(layer.id));
  const canvas = compositeLayers(doc, subtree, { background: 'none' });
  if (groupCache.size >= GROUP_CACHE_LIMIT) {
    const oldest = groupCache.keys().next().value;
    if (oldest) groupCache.delete(oldest);
  }
  groupCache.set(key, canvas);
  return canvas;
}

/** Group composite signature: any pixel-affecting change inside the group must change the key */
export function groupCompositeKey(doc: PhotoDoc, group: GroupLayer): string {
  const ids = new Set(subtreeIdsOf(doc, group.id));
  const parts: string[] = [`${doc.width}x${doc.height}`];
  for (const layer of doc.layers) {
    if (!ids.has(layer.id)) continue;
    const rev = layer.kind === 'raster' ? layer.rev : 0;
    const adjust =
      layer.kind === 'raster' || layer.kind === 'adjustment'
        ? bakeSignature('', rev, layer.adjustments ?? ({} as never), layer.filters ?? [])
        : layer.kind === 'smart'
          ? bakeSignature('', 0, layer.adjustments ?? NO_ADJUSTMENTS, layer.filters ?? [])
          : '';
    parts.push(
      [
        layer.id,
        rev,
        layer.visible ? 1 : 0,
        layer.opacity.toFixed(3),
        layer.blend,
        Math.round(layer.x),
        Math.round(layer.y),
        Math.round(layer.width),
        Math.round(layer.height),
        Math.round(layer.rotation),
        layer.flipX ? 1 : 0,
        layer.flipY ? 1 : 0,
        adjust,
        maskSignature(layer) ?? '',
        vectorMaskSignature(layer.vectorMask),
        layer.clipped ? 1 : 0,
        styleSignature(layer.style),
      ].join(','),
    );
  }
  return parts.join('|');
}

const groupCache = new Map<string, HTMLCanvasElement>();
const GROUP_CACHE_LIMIT = 12;

/**
 * An adjustment layer acts on what is below: bake the current canvas one more time.
 * It reuses `filters.bakeRaster` (the same CSS filter + pixel pass), so bitmap adjustments match exactly.
 */
function applyAdjustment(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  layer: AdjustmentLayer,
  region: Rect,
  scale: number,
  signaturePrefix = 'composite',
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Reuses bakeSignature, so extended adjustments and filter params are included and caches can't mix
  const signature = `${signaturePrefix}:adj:${layer.id}:${bakeSignature('', 0, layer.adjustments, layer.filters)}`;
  const baked = bakeRaster(canvas, signature, layer.adjustments, layer.filters);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(baked, 0, 0);
  // Restore the crop + scale transform so later layers can keep drawing in document coordinates
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.translate(-region.x, -region.y);
}

/** Index in doc.layers of the topmost visible adjustment layer; -1 when there is none */
export function adjustmentBaseIndex(doc: PhotoDoc): number {
  for (let index = doc.layers.length - 1; index >= 0; index -= 1) {
    const layer = doc.layers[index];
    if (layer.kind === 'adjustment' && layer.visible) return index;
  }
  return -1;
}

/** Composite everything up to and including the topmost adjustment layer (with background), as the base */
export function compositeBelowAdjustments(
  doc: PhotoDoc,
  options: CompositeOptions = {},
): HTMLCanvasElement | null {
  const baseIndex = adjustmentBaseIndex(doc);
  if (baseIndex < 0) return null;
  const key = `${baseIndex}:${docSignature(doc)}`;
  const cached = adjustmentCache.get(key);
  if (cached) return cached;
  const canvas = compositeLayers(doc, doc.layers.slice(0, baseIndex + 1), {
    background: options.background ?? doc.background,
    scale: options.scale ?? 1,
    signaturePrefix: options.signaturePrefix ?? 'base',
  });
  if (adjustmentCache.size >= ADJUSTMENT_CACHE_LIMIT) {
    const oldest = adjustmentCache.keys().next().value;
    if (oldest) adjustmentCache.delete(oldest);
  }
  adjustmentCache.set(key, canvas);
  return canvas;
}

/** Document render signature: any field affecting the picture changes the key (for adjustment-layer caches) */
export function docSignature(doc: PhotoDoc): string {
  const parts = [`${doc.width}x${doc.height}:${doc.background}`];
  for (const layer of doc.layers) {
    parts.push(
      [
        layer.id,
        layer.kind === 'raster' ? layer.rev : 0,
        layer.visible ? 1 : 0,
        layer.locked ? 1 : 0,
        layer.opacity.toFixed(3),
        layer.blend,
        Math.round(layer.x),
        Math.round(layer.y),
        Math.round(layer.width),
        Math.round(layer.height),
        Math.round(layer.rotation),
        layer.flipX ? 1 : 0,
        layer.flipY ? 1 : 0,
        layer.kind === 'group' ? (layer.passThrough ? 1 : 0) : 0,
        layer.kind === 'raster' || layer.kind === 'adjustment'
          ? bakeSignature('', 0, layer.adjustments ?? ({} as never), layer.filters ?? [])
          : layer.kind === 'smart'
            ? bakeSignature('', 0, layer.adjustments ?? NO_ADJUSTMENTS, layer.filters ?? [])
            : '',
        layer.kind === 'text'
          ? `${layer.text}:${layer.fontSize}:${layer.direction ?? 'horizontal'}:${JSON.stringify(layer.runs ?? null)}`
          : '',
        maskSignature(layer) ?? '',
        vectorMaskSignature(layer.vectorMask),
        layer.clipped ? 1 : 0,
        styleSignature(layer.style),
      ].join(','),
    );
  }
  return parts.join('|');
}

const adjustmentCache = new Map<string, HTMLCanvasElement>();
const ADJUSTMENT_CACHE_LIMIT = 8;
