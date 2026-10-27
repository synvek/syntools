import {
  activeFilters,
  bakeSignature,
  clipBaseIndex,
  hasActiveFilters,
  hasLayerStyle,
  hasVectorMask,
  maskSignature,
  meshPadding,
  meshSignature,
  NO_ADJUSTMENTS,
  stylePadding,
  vectorMaskSignature,
} from '../core';
import { createCanvasElement, getCanvas } from '../model/assets';
import { drawText } from './text';
import { textBitmap } from './warp';
import { compositeLayers, groupComposite } from './composite';
import { bakeRaster } from './filters';
import { applyMask, applyVectorMask } from './mask';
import { meshLayerBitmap } from './mesh';
import { paintLayerStyle } from './style';
import type { Layer, LayerStyle, PhotoDoc, ShapeKind } from '../model/types';

/**
 * Canvas2D paint layer: draw any layer (bitmap / text / shape) onto a 2D context.
 *
 * Export, flatten and thumbnails share it so output matches the preview; Konva only handles interaction.
 *
 * Key rule: **masks and layer styles must act on the layer's own pixels**,
 * so such layers are composited offscreen first (`composedLayerCanvas`) and then drawn as a whole.
 * Preview (Konva uses that composite as its Image) and export (`compositeLayers` → `paintLayer`) share the path,
 * ruling out double-pipeline drift like "masks in the preview but not in the export".
 */

export interface PaintOptions {
  /** Bake cache key prefix (per-document by default; thumbnails pass their own to avoid collisions) */
  signaturePrefix?: string;
  /** Document: group compositing / mask and style passes need it for the subtree and document size */
  doc?: PhotoDoc;
  /** Base layer of the clipping mask (passed in by `compositeLayers` / the Konva node) */
  clipBase?: Layer | null;
}

/**
 * Whether a layer needs "composite offscreen, then draw as a whole":
 * pixel masks / vector masks / layer styles / clipping masks all need the layer's own pixels first.
 */
export function layerNeedsComposite(layer: Layer): boolean {
  return (
    Boolean(layer.mask?.enabled) ||
    hasVectorMask(layer.vectorMask) ||
    hasLayerStyle(layer.style) ||
    Boolean(layer.clipped) ||
    // Smart filters: the bake is not just "scaled source pixels", so they need offscreen compositing
    (layer.kind === 'smart' && hasActiveFilters(layer.filters))
  );
}

/** Padding of the composite buffer around the layer box (where layer styles spread outward) */
export function composedLayerPadding(layer: Layer): number {
  // Mesh warp throws content outside the box, so include it or the buffer clips the warped result
  return stylePadding(layer.style) + meshPadding(layer.mesh, layer.width, layer.height);
}

/** Document coordinates of the composite buffer's top-left corner */
export function composedLayerOrigin(layer: Layer): { x: number; y: number } {
  const pad = composedLayerPadding(layer);
  return { x: layer.x - pad, y: layer.y - pad };
}

/**
 * Composite signature: any change to mask / vector mask / style / clipping mask must make Konva rebuild it.
 * `clipKey` comes from the caller (base layer id plus content revision), so a changed base refreshes the clip.
 */
export function compositeSignature(layer: Layer, clipKey = ''): string {
  return [
    maskSignature(layer) ?? '',
    vectorMaskSignature(layer.vectorMask),
    layer.vectorMask?.enabled
      ? `vm${layer.vectorMask.inverted ? 'i' : ''}${layer.vectorMask.feather}`
      : '',
    layer.style ? JSON.stringify(layer.style) : '',
    layer.clipped ? `clip:${clipKey}` : '',
  ].join('#');
}

/**
 * Content signature of the base layer: only changes to its **silhouette** alter the clip result,
 * so it covers pixel revision / mask / text content only, never opacity or blend mode.
 */
export function clipKeyOf(base: Layer | null | undefined): string {
  if (!base) return '';
  return [
    base.id,
    base.kind === 'raster' ? base.rev : 0,
    maskSignature(base) ?? '',
    vectorMaskSignature(base.vectorMask),
    base.kind === 'text' ? `${base.text}:${base.fontSize}` : '',
    base.visible ? 1 : 0,
  ].join(',');
}

/** Find a layer's clip base (the nearest drawable layer below it at the same level) */
export function clipBaseOf(doc: PhotoDoc, layer: Layer): Layer | null {
  const index = doc.layers.findIndex((item) => item.id === layer.id);
  if (index < 0) return null;
  const baseIndex = clipBaseIndex(doc.layers, index);
  return baseIndex >= 0 ? doc.layers[baseIndex] : null;
}

/** Layer content plus its own masks (pixel / vector), no style or opacity: reused as a clip-base shape */
function layerShapeCanvas(
  doc: PhotoDoc,
  layer: Layer,
  width: number,
  height: number,
  origin: { x: number; y: number },
  options: PaintOptions,
): HTMLCanvasElement | null {
  const canvas = createCanvasElement(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.translate(-origin.x, -origin.y);
  paintLayerContent(ctx, layer, { ...options, doc });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  applyLayerMasks(canvas, layer, origin);
  return canvas;
}

/** Apply a layer's two kinds of mask to the canvas (pixel mask → vector mask) */
function applyLayerMasks(
  canvas: HTMLCanvasElement,
  layer: Layer,
  origin: { x: number; y: number },
): void {
  const rect = {
    x: layer.x - origin.x,
    y: layer.y - origin.y,
    width: layer.width,
    height: layer.height,
  };
  const mask = layer.mask;
  if (mask?.enabled) {
    applyMask(canvas, mask, maskSignature(layer) ?? `${mask.assetId}:${mask.rev}`, rect);
  }
  const vector = layer.vectorMask;
  if (hasVectorMask(vector) && vector) {
    applyVectorMask(
      canvas,
      vector,
      { x: rect.x, y: rect.y },
      {
        width: layer.width,
        height: layer.height,
      },
    );
  }
}

/**
 * Flatten "layer content + both masks + clipping mask + layer style" into a single canvas
 * (larger than the layer box by `stylePadding` on every side).
 *
 * Draw order: content → pixel mask → vector mask → layer style → clipping mask.
 * The clip comes last, as in Photoshop: the whole layer (effects included) is clipped by the base's alpha.
 */
export function composedLayerCanvas(
  doc: PhotoDoc,
  layer: Layer,
  options: PaintOptions = {},
): HTMLCanvasElement | null {
  const pad = composedLayerPadding(layer);
  const width = Math.max(1, Math.round(layer.width + pad * 2));
  const height = Math.max(1, Math.round(layer.height + pad * 2));
  const origin = composedLayerOrigin(layer);

  const content = layerShapeCanvas(doc, layer, width, height, origin, options);
  if (!content) return null;

  const style = layer.style;
  let out = content;
  if (hasLayerStyle(style)) {
    const styled = createCanvasElement(width, height);
    const octx = styled.getContext('2d');
    if (octx) {
      paintLayerStyle(octx, style as LayerStyle, content);
      out = styled;
    }
  }

  if (layer.clipped && options.clipBase) {
    const base = layerShapeCanvas(doc, options.clipBase, width, height, origin, options);
    const ctx = base?.getContext('2d');
    if (base && ctx) {
      // Keep only the base layer's alpha (its shape) and use it to clip this layer
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      const outCtx = out.getContext('2d');
      if (outCtx) {
        outCtx.save();
        outCtx.globalCompositeOperation = 'destination-in';
        outCtx.drawImage(base, 0, 0);
        outCtx.restore();
      }
    }
  }

  return out;
}

export function paintLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  options: PaintOptions = {},
): void {
  if (!layer.visible) return;
  ctx.save();
  ctx.globalAlpha *= layer.opacity;
  ctx.globalCompositeOperation = layer.blend === 'normal' ? 'source-over' : layer.blend;
  applyTransform(ctx, layer);

  if (options.doc && layerNeedsComposite(layer)) {
    const composed = composedLayerCanvas(options.doc, layer, options);
    if (composed) {
      const origin = composedLayerOrigin(layer);
      ctx.drawImage(composed, origin.x, origin.y);
      ctx.restore();
      return;
    }
  }

  paintLayerContent(ctx, layer, options);
  ctx.restore();
}

/**
 * The layer content itself (no opacity / blend mode / rotation or flip — `paintLayer` applies those).
 * Exposed separately so the style pass can get the un-styled silhouette.
 */
/**
 * Cache key for the mesh warp: it must cover everything that changes the "undeformed pixels".
 *
 * Bitmaps cache in **undeformed** local space, so position / rotation / flip / opacity are excluded,
 * otherwise dragging a layer would rebuild a bitmap every frame.
 */
export function meshContentKey(layer: Layer, prefix = 'doc'): string {
  const pixelKey =
    layer.kind === 'raster'
      ? bakeSignature(layer.assetId, layer.rev, layer.adjustments, layer.filters)
      : JSON.stringify({
          ...layer,
          x: 0,
          y: 0,
          rotation: 0,
          opacity: 1,
          visible: true,
          blend: 'normal',
          flipX: false,
          flipY: false,
          mesh: null,
        });
  return [prefix, layer.id, meshSignature(layer.mesh), compositeSignature(layer), pixelKey].join(
    '|',
  );
}

export function paintLayerContent(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  options: PaintOptions = {},
): void {
  // Mesh warp (perspective / distort / skew / warp): draw normally to an offscreen canvas, then resample.
  // Same strategy as text warp: preview and export share one bitmap, so the pipelines can't drift.
  const meshBitmap = meshLayerBitmap(
    layer,
    meshContentKey(layer, options.signaturePrefix),
    (inner, box) => {
      // Draw inside the callback with the mesh cleared, so it can't re-enter this branch and recurse
      paintLayerContent(inner, { ...layer, mesh: null, x: box.x, y: box.y } as Layer, options);
    },
  );
  if (meshBitmap) {
    ctx.drawImage(meshBitmap.canvas, meshBitmap.offsetX, meshBitmap.offsetY);
    return;
  }
  if (layer.kind === 'raster') {
    const asset = getCanvas(layer.assetId);
    if (asset) {
      const baked = bakeRaster(
        asset,
        `${options.signaturePrefix ?? 'doc'}:${bakeSignature(layer.assetId, layer.rev, layer.adjustments, layer.filters)}`,
        layer.adjustments,
        layer.filters,
      );
      ctx.drawImage(baked, layer.x, layer.y, layer.width, layer.height);
    }
  } else if (layer.kind === 'text') {
    paintText(ctx, layer);
  } else if (layer.kind === 'shape') {
    paintShape(ctx, layer);
  } else if (layer.kind === 'group') {
    // In pass-through mode the caller draws children one by one; otherwise the group is composited first
    if (!layer.passThrough && options.doc) {
      ctx.drawImage(
        groupComposite(options.doc, layer),
        0,
        0,
        options.doc.width,
        options.doc.height,
      );
    }
  } else if (layer.kind === 'smart') {
    const source = getCanvas(layer.sourceAssetId);
    if (source) {
      const filters = activeFilters(layer.filters);
      const width = Math.max(1, Math.round(layer.width));
      const height = Math.max(1, Math.round(layer.height));
      if (filters.length === 0) {
        ctx.drawImage(source, layer.x, layer.y, layer.width, layer.height);
      } else {
        // Smart filters act at the presentation size: scale to the current size first, then bake,
        // so scaling a smart object doesn't scale the blur radius and friends along with it.
        const scaled = createCanvasElement(width, height);
        const scaledCtx = scaled.getContext('2d');
        if (!scaledCtx) return;
        scaledCtx.drawImage(source, 0, 0, width, height);
        const baked = bakeRaster(
          scaled,
          `${options.signaturePrefix ?? 'doc'}:smart:${layer.id}:${layer.width}x${layer.height}:${filters
            .map((spec) => `${spec.id}:${JSON.stringify(spec.params ?? {})}`)
            .join('|')}`,
          layer.adjustments ?? NO_ADJUSTMENTS,
          filters,
        );
        ctx.drawImage(baked, layer.x, layer.y, layer.width, layer.height);
      }
    }
  }
  // adjustment layers are handled by render/composite.ts when applied to the composite below
}

/**
 * Draw all layers in document order (the core of export / flatten).
 *
 * It runs the same `compositeLayers` pipeline as the canvas preview, so groups, masks and adjustment layers
 * can't be missed — inconsistencies like "preview right, export missing an adjustment" are hard to debug.
 */
export function paintDoc(
  ctx: CanvasRenderingContext2D,
  doc: PhotoDoc,
  options: PaintOptions = {},
): void {
  const canvas = compositeLayers(doc, doc.layers, {
    background: doc.background,
    signaturePrefix: options.signaturePrefix,
  });
  ctx.save();
  ctx.clearRect(0, 0, doc.width, doc.height);
  ctx.drawImage(canvas, 0, 0, doc.width, doc.height);
  ctx.restore();
}

export function applyTransform(ctx: CanvasRenderingContext2D, layer: Layer): void {
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  if (layer.rotation || layer.flipX || layer.flipY) {
    ctx.translate(cx, cy);
    if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
    ctx.translate(-cx, -cy);
  }
}

/**
 * Text drawing.
 *
 * Plain text goes straight to Canvas2D (`render/text.ts`, sharing layout with the preview);
 * warped / paragraph-spaced text is rendered to a bitmap by `render/warp.ts` and pasted in — the same
 * bitmap the preview uses, so what you see on the canvas is exactly what gets exported.
 */
function paintText(ctx: CanvasRenderingContext2D, layer: Extract<Layer, { kind: 'text' }>): void {
  const bitmap = textBitmap(layer);
  if (bitmap) {
    ctx.drawImage(bitmap.canvas, layer.x + bitmap.offsetX, layer.y + bitmap.offsetY);
    return;
  }
  drawText(ctx, layer);
}

/** Text wrapping: CJK breaks per character, Latin at spaces (see `render/text.ts`; re-exported for callers) */
export { wrapText } from './text';

function paintShape(ctx: CanvasRenderingContext2D, layer: Extract<Layer, { kind: 'shape' }>): void {
  const { x, y, width, height } = layer;
  ctx.beginPath();
  switch (layer.shape) {
    case 'ellipse':
      ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      break;
    case 'roundRect':
      roundRectPath(
        ctx,
        x,
        y,
        width,
        height,
        Math.min(layer.cornerRadius, Math.min(width, height) / 2),
      );
      break;
    case 'line':
      // A line runs along the drag box's diagonal: drag a box and get a diagonal inside it,
      // so like rect / arrow / star the stroke stays inside the box (it used to sit on the vertical mid-line)
      ctx.moveTo(x, y);
      ctx.lineTo(x + width, y + height);
      break;
    case 'arrow':
      ctx.moveTo(x, y + height);
      ctx.lineTo(x + width / 2, y);
      ctx.lineTo(x + width, y + height);
      break;
    case 'star':
      starPath(ctx, x + width / 2, y + height / 2, width / 2, height / 2, 5);
      break;
    default:
      ctx.rect(x, y, width, height);
  }
  if (layer.shape !== 'line' && layer.shape !== 'arrow' && layer.fill) {
    ctx.fillStyle = layer.fill;
    ctx.fill();
  }
  if (layer.strokeWidth > 0 && layer.stroke) {
    ctx.strokeStyle = layer.stroke;
    ctx.lineWidth = layer.strokeWidth;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
}

export function starPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  points: number,
): void {
  const inner = 0.5;
  for (let i = 0; i < points * 2; i += 1) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const scale = i % 2 === 0 ? 1 : inner;
    const px = cx + Math.cos(angle) * rx * scale;
    const py = cy + Math.sin(angle) * ry * scale;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function shapeLabel(shape: ShapeKind): string {
  return shape;
}
