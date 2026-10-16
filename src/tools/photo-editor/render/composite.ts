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
 * 离屏合成管线：编组（整体合成模式）、蒙版、调整图层都在这里合成，
 * 画布预览、图片导出与 PSD 导出共用同一份结果，保证「所见即所得」。
 *
 * 未被这些特性用到的图层仍走 `render/nodes.ts` 的 Konva 节点（文本清晰、增量更新快），
 * 只有真正需要「先把若干图层压成一张图」时才付出离屏合成的代价。
 */

export interface CompositeOptions {
  /** 只合成该区域（文档坐标）；缺省为整块画布 */
  clip?: Rect | null;
  /** 输出缩放：1 = 原尺寸，<1 用于预览降采样 */
  scale?: number;
  /** 背景填充；'none' 表示透明（组内合成用） */
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
      // 穿透模式下子图层各自混合，由调用方（层栈展开）逐个绘制
      if (layer.passThrough || !layer.visible) continue;
      if (!layerNeedsComposite(layer)) {
        // 无蒙版 / 无样式的快路径：整组先合成成一张图，再按本组的透明度与混合模式整体绘制
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.globalCompositeOperation = layer.blend === 'normal' ? 'source-over' : layer.blend;
        ctx.drawImage(groupComposite(doc, layer), 0, 0, doc.width, doc.height);
        ctx.restore();
        continue;
      }
      // 有蒙版 / 图层样式 / 剪贴蒙版：统一走 `paintLayer` 的合成路径，保证与预览一致
      paintLayer(ctx, layer, {
        doc,
        signaturePrefix: options.signaturePrefix ?? 'composite',
        clipBase: clipBaseOf(doc, layer),
      });
      continue;
    }
    if (layer.kind === 'adjustment') {
      // 调整图层：作用于「已合成的下方内容」——把画布整体烘焙一遍（CSS filter + 像素通道）
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
 * 编组整体合成：把组内子树压成一张画布（透明背景），
 * 结果按签名缓存——子图层没变时复用，避免每帧重画。
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

/** 编组合成签名：组内任何影响像素的字段变化都要换键 */
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
 * 调整图层作用于其下方内容：把当前画布整体再烘焙一次。
 * 复用 `filters.bakeRaster`（同一套 CSS filter + 像素通道），保证与位图图层的调整完全一致。
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
  // 签名复用 bakeSignature：扩展调整与滤镜参数一并参与，缓存不会串味
  const signature = `${signaturePrefix}:adj:${layer.id}:${bakeSignature('', 0, layer.adjustments, layer.filters)}`;
  const baked = bakeRaster(canvas, signature, layer.adjustments, layer.filters);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(baked, 0, 0);
  // 还原「裁剪 + 缩放」变换，后续图层才能继续按文档坐标绘制
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.translate(-region.x, -region.y);
}

/** 最上方一个「可见的调整图层」在 doc.layers 中的下标；没有则返回 -1 */
export function adjustmentBaseIndex(doc: PhotoDoc): number {
  for (let index = doc.layers.length - 1; index >= 0; index -= 1) {
    const layer = doc.layers[index];
    if (layer.kind === 'adjustment' && layer.visible) return index;
  }
  return -1;
}

/** 合成「最上方调整图层及其以下」的全部内容（含背景），作为画布的底层节点 */
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

/** 文档渲染签名：参与画面的字段一变就换键（用于调整图层合成缓存） */
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
        layer.kind === 'text' ? `${layer.text}:${layer.fontSize}` : '',
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
