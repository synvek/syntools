import Konva from 'konva';
import { bakeSignature, meshIsIdentity, needsTextBitmap } from '../core';
import { getCanvas } from '../model/assets';
import { groupComposite, groupCompositeKey } from './composite';
import { bakeRaster, bakeRasterLive } from './filters';
import {
  clipBaseOf,
  clipKeyOf,
  compositeSignature,
  composedLayerCanvas,
  composedLayerOrigin,
  layerNeedsComposite,
  meshContentKey,
  paintLayerContent,
  starPath,
} from './paint';
import { meshBitmapOrigin, meshLayerBitmap } from './mesh';
import { textBitmap, type WarpedText } from './warp';
import type { GroupLayer, Layer, PhotoDoc, ShapeLayer, TextLayer } from '../model/types';

/**
 * Layer → Konva node factory.
 *
 * Each node carries three custom attributes (`layerId` / `layerKind` / `bakeKey`) that
 * `sync.ts` uses to choose between updating in place and destroying / rebuilding.
 */

export const LAYER_ID_ATTR = 'layerId';
export const LAYER_KIND_ATTR = 'layerKind';
export const BAKE_KEY_ATTR = 'bakeKey';
/** Bitmap of warped text (stored on the node, so sceneFunc closures don't capture a stale layer) */
const TEXT_BITMAP_ATTR = 'textBitmap';

/** Bitmap bake key: asset + revision + adjustment / filter parameters */
export function bakeKeyOf(layer: Layer): string {
  if (layer.kind !== 'raster') return '';
  return bakeSignature(layer.assetId, layer.rev, layer.adjustments, layer.filters);
}

/**
 * Create a layer node.
 * `group` / `adjustment` / `smart` currently return an empty Group placeholder (S3/S5/S6 wire up the
 * real composite), which keeps the types complete now and only needs the branch swapped later.
 */
export function createLayerNode(layer: Layer, doc?: PhotoDoc): Konva.Shape | Konva.Group {
  // With mask / layer style: composite into one image first (both must act on the layer's own pixels),
  // reusing the exact `composedLayerCanvas` the export uses, so preview and output can't drift.
  if (doc && layerNeedsComposite(layer)) {
    const clipBase = layer.clipped ? clipBaseOf(doc, layer) : null;
    const canvas = composedLayerCanvas(doc, layer, { doc, clipBase });
    if (canvas) {
      const node = new Konva.Image({
        image: canvas,
        width: canvas.width,
        height: canvas.height,
        listening: false,
        perfectDrawEnabled: false,
      });
      node.setAttr(LAYER_ID_ATTR, layer.id);
      node.setAttr(LAYER_KIND_ATTR, `composed:${layer.kind}`);
      node.setAttr(BAKE_KEY_ATTR, compositeSignature(layer, clipKeyOf(clipBase)));
      applyCommon(node, layer, composedLayerOrigin(layer), true);
      return node;
    }
  }
  // Mesh warp (this path when there is no mask / style; the composite branch above already warps)
  if (!layerNeedsComposite(layer) && !meshIsIdentity(layer.mesh)) {
    const key = meshContentKey(layer, 'preview');
    const bitmap = meshLayerBitmap(layer, key, (inner, box) => {
      paintLayerContent(inner, { ...layer, mesh: null, x: box.x, y: box.y } as Layer, { doc });
    });
    if (bitmap) {
      const node = new Konva.Image({
        image: bitmap.canvas,
        width: bitmap.canvas.width,
        height: bitmap.canvas.height,
        listening: false,
        perfectDrawEnabled: false,
      });
      node.setAttr(LAYER_ID_ATTR, layer.id);
      node.setAttr(LAYER_KIND_ATTR, 'mesh');
      node.setAttr(BAKE_KEY_ATTR, key);
      // Position at the buffer's top-left, with the composite path's transforms (rotate / flip about center)
      applyCommon(node, layer, { x: bitmap.offsetX, y: bitmap.offsetY }, true);
      return node;
    }
  }

  const node: Konva.Shape | Konva.Group =
    layer.kind === 'raster'
      ? createRasterNode(layer)
      : layer.kind === 'text'
        ? createTextNode(layer)
        : layer.kind === 'shape'
          ? createShapeNode(layer)
          : layer.kind === 'smart'
            ? createSmartNode(layer)
            : layer.kind === 'group' && doc
              ? createGroupNode(layer, doc)
              : new Konva.Group({ listening: false });
  node.setAttr(LAYER_ID_ATTR, layer.id);
  // Shapes are keyed by kind: switching the shape kind must rebuild the node
  node.setAttr(
    LAYER_KIND_ATTR,
    layer.kind === 'shape'
      ? `shape:${layer.shape}`
      : layer.kind === 'text' && needsTextBitmap(layer)
        ? 'text:bitmap'
        : layer.kind,
  );
  if (layer.kind === 'raster') node.setAttr(BAKE_KEY_ATTR, bakeKeyOf(layer));
  applyCommon(node, layer);
  return node;
}

/**
 * Update in place: when the type is unchanged only attributes change, avoiding whole-tree rebuild flicker.
 *
 * `live = true` is for the middle of a stroke: the signature (rev) is unchanged but pixels already are,
 * so the image must bypass the bake cache, or the canvas would refresh only on release.
 */
export function updateLayerNode(
  node: Konva.Node,
  layer: Layer,
  live = false,
  doc?: PhotoDoc,
): void {
  if (node.getAttr(LAYER_KIND_ATTR) === 'mesh' && node instanceof Konva.Image) {
    const key = meshContentKey(layer, 'preview');
    if (live || node.getAttr(BAKE_KEY_ATTR) !== key) {
      const bitmap = meshLayerBitmap(layer, key, (inner, box) => {
        paintLayerContent(inner, { ...layer, mesh: null, x: box.x, y: box.y } as Layer, { doc });
      });
      if (bitmap) node.image(bitmap.canvas);
      node.setAttr(BAKE_KEY_ATTR, key);
    }
    applyCommon(node, layer, meshBitmapOrigin(layer), true);
    return;
  }

  if (doc && layerNeedsComposite(layer) && node instanceof Konva.Image) {
    const clipBase = layer.clipped ? clipBaseOf(doc, layer) : null;
    const key = compositeSignature(layer, clipKeyOf(clipBase));
    if (live || node.getAttr(BAKE_KEY_ATTR) !== key) {
      const canvas = composedLayerCanvas(doc, layer, { doc, clipBase });
      if (canvas) {
        node.image(canvas);
        node.size({ width: canvas.width, height: canvas.height });
        node.setAttr(BAKE_KEY_ATTR, key);
      }
    }
    applyCommon(node, layer, composedLayerOrigin(layer), true);
    return;
  }
  if (layer.kind === 'raster' && node instanceof Konva.Image) {
    const asset = getCanvas(layer.assetId);
    const key = bakeKeyOf(layer);
    if (asset && (live || node.getAttr(BAKE_KEY_ATTR) !== key)) {
      node.image(
        live
          ? // live passes the signature: the preview downsamples while the Worker computes full resolution
            bakeRasterLive(asset, layer.adjustments, layer.filters, key)
          : bakeRaster(asset, key, layer.adjustments, layer.filters),
      );
      node.setAttr(BAKE_KEY_ATTR, key);
    }
  } else if (layer.kind === 'group' && node instanceof Konva.Image && doc) {
    const key = groupCompositeKey(doc, layer);
    if (live || node.getAttr(BAKE_KEY_ATTR) !== key) {
      node.image(groupComposite(doc, layer));
      node.setAttr(BAKE_KEY_ATTR, key);
    }
    node.size({ width: Math.max(1, doc.width), height: Math.max(1, doc.height) });
  } else if (layer.kind === 'text' && node instanceof Konva.Text) {
    node.text(layer.text);
    node.fontSize(layer.fontSize);
    node.fontFamily(layer.fontFamily);
    node.fill(layer.fill);
    node.width(layer.width);
    node.align(layer.align);
    node.lineHeight(layer.lineHeight);
    node.letterSpacing(layer.letterSpacing ?? 0);
    node.fontStyle(fontStyleOf(layer));
    node.textDecoration(layer.underline ? 'underline' : '');
  } else if (layer.kind === 'text') {
    // Warp / paragraph spacing: bitmaps cache by signature, so re-fetching on sync just hits the cache
    node.setAttr(TEXT_BITMAP_ATTR, textBitmap(layer));
  } else if (layer.kind === 'shape') {
    updateShapeNode(node, layer);
  }
  applyCommon(node, layer);
}

/**
 * Sync a node's position and transform.
 *
 * `composed` nodes (offscreen composite / group) must pivot on the layer box's center (position = center,
 * offset = center to buffer top-left) to align pixel-for-pixel with Canvas2D's `applyTransform`, which
 * rotates / flips about that center; plain nodes still anchor at the top-left, as before.
 */
function applyCommon(
  node: Konva.Node,
  layer: Layer,
  origin?: { x: number; y: number },
  composed = false,
): void {
  if (composed || layer.kind === 'group') {
    const anchor = origin ?? { x: layer.x, y: layer.y };
    const cx = layer.x + layer.width / 2;
    const cy = layer.y + layer.height / 2;
    node.position({ x: cx, y: cy });
    node.offset({ x: cx - anchor.x, y: cy - anchor.y });
  } else {
    node.position({ x: layer.x, y: layer.y });
    node.offset({ x: 0, y: 0 });
  }
  node.opacity(layer.opacity);
  node.rotation(layer.rotation);
  node.scale({ x: layer.flipX ? -1 : 1, y: layer.flipY ? -1 : 1 });
  node.visible(layer.visible);
  // Konva's source-over is "normal"; every other blend mode name matches Canvas2D
  node.setAttr('globalCompositeOperation', layer.blend === 'normal' ? 'source-over' : layer.blend);
  if (!composed && layer.kind === 'raster') {
    node.size({ width: Math.max(1, layer.width), height: Math.max(1, layer.height) });
  }
}

function createRasterNode(layer: Extract<Layer, { kind: 'raster' }>): Konva.Image {
  const asset = getCanvas(layer.assetId);
  const key = bakeKeyOf(layer);
  const image = asset ? bakeRaster(asset, key, layer.adjustments, layer.filters) : undefined;
  return new Konva.Image({
    image,
    width: Math.max(1, layer.width),
    height: Math.max(1, layer.height),
    listening: false,
    perfectDrawEnabled: false,
  });
}

/** Group (composited mode): an image node holding one offscreen composite */
function createGroupNode(layer: GroupLayer, doc: PhotoDoc): Konva.Image {
  return new Konva.Image({
    image: groupComposite(doc, layer),
    width: Math.max(1, doc.width),
    height: Math.max(1, doc.height),
    listening: false,
    perfectDrawEnabled: false,
  });
}

function createSmartNode(layer: Extract<Layer, { kind: 'smart' }>): Konva.Image {
  const source = getCanvas(layer.sourceAssetId);
  return new Konva.Image({
    image: source,
    width: Math.max(1, layer.width),
    height: Math.max(1, layer.height),
    listening: false,
    perfectDrawEnabled: false,
  });
}

/**
 * Text node.
 *
 * Two paths:
 * - plain text → `Konva.Text` (crisp at any zoom, font editable on the fly);
 * - warp / paragraph spacing → `Konva.Shape` + bitmap (`render/warp.ts`), the same code as the export.
 * The bitmap lives on node attributes instead of a closure over the layer, which would draw stale data.
 */
function createTextNode(layer: TextLayer): Konva.Text | Konva.Shape {
  if (needsTextBitmap(layer)) {
    const shape = new Konva.Shape({
      listening: false,
      sceneFunc: (context, node) => {
        const bitmap = node.getAttr(TEXT_BITMAP_ATTR) as WarpedText | undefined;
        if (!bitmap) return;
        (context as unknown as CanvasRenderingContext2D).drawImage(
          bitmap.canvas,
          bitmap.offsetX,
          bitmap.offsetY,
        );
      },
    });
    shape.setAttr(TEXT_BITMAP_ATTR, textBitmap(layer));
    return shape;
  }
  return new Konva.Text({
    text: layer.text,
    width: layer.width,
    fontSize: layer.fontSize,
    fontFamily: layer.fontFamily,
    fontStyle: fontStyleOf(layer),
    textDecoration: layer.underline ? 'underline' : '',
    fill: layer.fill,
    align: layer.align,
    lineHeight: layer.lineHeight,
    letterSpacing: layer.letterSpacing ?? 0,
    listening: false,
  });
}

function fontStyleOf(layer: TextLayer): string {
  if (layer.bold && layer.italic) return 'bold italic';
  if (layer.bold) return 'bold';
  if (layer.italic) return 'italic';
  return 'normal';
}

function createShapeNode(layer: ShapeLayer): Konva.Shape {
  const common = {
    fill: layer.fill || undefined,
    stroke: layer.strokeWidth > 0 ? layer.stroke : undefined,
    strokeWidth: layer.strokeWidth,
    listening: false,
  };
  switch (layer.shape) {
    case 'ellipse':
      // No Konva.Ellipse: its x / y is the **center**, while applyCommon sets every node's position to
      // the layer's top-left, so the oval lands at (x−w/2, y−h/2) and the whole stroke shifts up-left.
      // Everything draws in node-local coordinates via sceneFunc, and the export uses the same space.
      return new Konva.Shape({
        ...common,
        width: layer.width,
        height: layer.height,
        sceneFunc: (ctx, shape) => {
          const w = shape.width();
          const h = shape.height();
          ctx.beginPath();
          ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
          ctx.closePath();
          ctx.fillStrokeShape(shape);
        },
      });
    case 'roundRect':
      return new Konva.Rect({
        ...common,
        width: layer.width,
        height: layer.height,
        cornerRadius: Math.min(layer.cornerRadius, Math.min(layer.width, layer.height) / 2),
      });
    case 'line':
      return new Konva.Line({
        ...common,
        points: [0, 0, layer.width, layer.height],
        stroke: layer.stroke || layer.fill,
        strokeWidth: Math.max(1, layer.strokeWidth),
        fill: undefined,
      });
    case 'arrow':
      return new Konva.Arrow({
        ...common,
        points: [0, layer.height, layer.width / 2, 0, layer.width, layer.height],
        stroke: layer.stroke || layer.fill,
        strokeWidth: Math.max(1, layer.strokeWidth),
        fill: layer.fill || undefined,
        pointerLength: Math.min(layer.width, layer.height) * 0.25,
        pointerWidth: Math.min(layer.width, layer.height) * 0.25,
      });
    case 'star':
      return new Konva.Shape({
        ...common,
        width: layer.width,
        height: layer.height,
        // Draw using the node's own size (not the closure's layer) so scaling / transforming refreshes it
        sceneFunc: (ctx: Konva.Context, shape: Konva.Shape) => {
          const w = shape.width();
          const h = shape.height();
          starPath(ctx as unknown as CanvasRenderingContext2D, w / 2, h / 2, w / 2, h / 2, 5);
          ctx.fillStrokeShape(shape);
        },
      });
    default:
      return new Konva.Rect({ ...common, width: layer.width, height: layer.height });
  }
}

function updateShapeNode(node: Konva.Node, layer: ShapeLayer): void {
  if (node instanceof Konva.Rect) {
    node.size({ width: layer.width, height: layer.height });
    node.fill(layer.fill || undefined);
    node.stroke(layer.strokeWidth > 0 ? layer.stroke : undefined);
    node.strokeWidth(layer.strokeWidth);
    if (layer.shape === 'roundRect') {
      node.cornerRadius(Math.min(layer.cornerRadius, Math.min(layer.width, layer.height) / 2));
    }
    return;
  }
  // Arrow extends Line, so test for arrows first or they get reset as plain lines
  if (node instanceof Konva.Arrow) {
    node.points([0, layer.height, layer.width / 2, 0, layer.width, layer.height]);
    node.stroke(layer.stroke || layer.fill);
    node.strokeWidth(Math.max(1, layer.strokeWidth));
    return;
  }
  if (node instanceof Konva.Line) {
    node.points([0, 0, layer.width, layer.height]);
    node.stroke(layer.stroke || layer.fill);
    node.strokeWidth(Math.max(1, layer.strokeWidth));
    return;
  }
  // Oval / star: sceneFunc draws from the node's own size; this syncs size and colors
  node.width(layer.width);
  node.height(layer.height);
  node.setAttr('fill', layer.fill || undefined);
  node.setAttr('stroke', layer.strokeWidth > 0 ? layer.stroke : undefined);
  node.setAttr('strokeWidth', layer.strokeWidth);
}
