import Konva from 'konva';
import { bakeSignature, maskSignature } from '../core';
import { getCanvas } from '../model/assets';
import {
  groupComposite,
  groupCompositeKey,
  maskedLayerCanvas,
  maskedLayerOrigin,
} from './composite';
import { bakeRaster, bakeRasterLive } from './filters';
import { starPath } from './paint';
import type { GroupLayer, Layer, PhotoDoc, ShapeLayer, TextLayer } from '../model/types';

/**
 * 图层 → Konva 节点工厂。
 *
 * 每个节点带 `layerId` / `layerKind` / `bakeKey` 三个自定义属性，
 * `sync.ts` 据此决定「就地更新」还是「销毁重建」。
 */

export const LAYER_ID_ATTR = 'layerId';
export const LAYER_KIND_ATTR = 'layerKind';
export const BAKE_KEY_ATTR = 'bakeKey';

/** 位图烘焙键：资产 + 版本号 + 调整/滤镜参数 */
export function bakeKeyOf(layer: Layer): string {
  if (layer.kind !== 'raster') return '';
  return bakeSignature(layer.assetId, layer.rev, layer.adjustments, layer.filters);
}

/**
 * 创建图层节点。
 * `group` / `adjustment` / `smart` 目前返回空 Group 占位（S3/S5/S6 接入离屏合成后的真实内容），
 * 这样在它们尚未可被创建时就已类型完备，后续只需替换分支实现。
 */
export function createLayerNode(layer: Layer, doc?: PhotoDoc): Konva.Shape | Konva.Group {
  // 带蒙版：整体先合成为一张图（蒙版必须作用在「该图层自己的像素」上）
  if (doc && layer.mask?.enabled) {
    const canvas = maskedLayerCanvas(doc, layer);
    if (canvas) {
      const origin = maskedLayerOrigin(doc, layer);
      const node = new Konva.Image({
        image: canvas,
        x: origin.x,
        y: origin.y,
        width: canvas.width,
        height: canvas.height,
        listening: false,
        perfectDrawEnabled: false,
      });
      node.setAttr(LAYER_ID_ATTR, layer.id);
      node.setAttr(LAYER_KIND_ATTR, `masked:${layer.kind}`);
      applyCommon(node, layer, origin);
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
  // 形状按具体图形区分：更换图形类型时必须重建节点
  node.setAttr(LAYER_KIND_ATTR, layer.kind === 'shape' ? `shape:${layer.shape}` : layer.kind);
  if (layer.kind === 'raster') node.setAttr(BAKE_KEY_ATTR, bakeKeyOf(layer));
  applyCommon(node, layer);
  return node;
}

/**
 * 就地更新：类型未变时只改属性，避免整树重建导致闪烁。
 *
 * `live = true` 用于落笔过程中：签名（rev）没变但像素已经变了，
 * 必须绕过 bake 缓存重新取图，否则画面要到松手才刷新。
 */
export function updateLayerNode(
  node: Konva.Node,
  layer: Layer,
  live = false,
  doc?: PhotoDoc,
): void {
  if (doc && layer.mask?.enabled && node instanceof Konva.Image) {
    const key = maskSignature(layer) ?? '';
    if (live || node.getAttr(BAKE_KEY_ATTR) !== key) {
      const canvas = maskedLayerCanvas(doc, layer);
      if (canvas) {
        const origin = maskedLayerOrigin(doc, layer);
        node.image(canvas);
        node.size({ width: canvas.width, height: canvas.height });
        node.position(origin);
        node.setAttr(BAKE_KEY_ATTR, key);
      }
    }
    node.opacity(layer.opacity);
    node.rotation(0);
    node.visible(layer.visible);
    return;
  }
  if (layer.kind === 'raster' && node instanceof Konva.Image) {
    const asset = getCanvas(layer.assetId);
    const key = bakeKeyOf(layer);
    if (asset && (live || node.getAttr(BAKE_KEY_ATTR) !== key)) {
      node.image(
        live
          ? bakeRasterLive(asset, layer.adjustments, layer.filters)
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
    node.fontStyle(fontStyleOf(layer));
    node.textDecoration(layer.underline ? 'underline' : '');
  } else if (layer.kind === 'shape') {
    updateShapeNode(node, layer);
  }
  applyCommon(node, layer);
}

function applyCommon(node: Konva.Node, layer: Layer, origin?: { x: number; y: number }): void {
  node.position(origin ?? { x: layer.x, y: layer.y });
  node.opacity(layer.opacity);
  node.rotation(layer.rotation);
  node.scale({ x: layer.flipX ? -1 : 1, y: layer.flipY ? -1 : 1 });
  node.visible(layer.visible);
  // Konva 的 source-over 即「正常」；其余混合模式名与 Canvas2D 一致
  node.setAttr('globalCompositeOperation', layer.blend === 'normal' ? 'source-over' : layer.blend);
  if (layer.kind === 'raster') {
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

/** 编组（整体合成模式）：一张离屏合成结果的图片节点 */
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

function createTextNode(layer: TextLayer): Konva.Text {
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
      return new Konva.Ellipse({
        ...common,
        x: layer.width / 2,
        y: layer.height / 2,
        radiusX: layer.width / 2,
        radiusY: layer.height / 2,
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
        points: [0, layer.height / 2, layer.width, layer.height / 2],
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
        sceneFunc: (ctx: Konva.Context, shape: Konva.Shape) => {
          starPath(
            ctx as unknown as CanvasRenderingContext2D,
            layer.width / 2,
            layer.height / 2,
            layer.width / 2,
            layer.height / 2,
            5,
          );
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
  if (node instanceof Konva.Ellipse) {
    node.radius({ x: layer.width / 2, y: layer.height / 2 });
    node.fill(layer.fill || undefined);
    node.stroke(layer.strokeWidth > 0 ? layer.stroke : undefined);
    node.strokeWidth(layer.strokeWidth);
    return;
  }
  if (node instanceof Konva.Line) {
    node.points([0, layer.height / 2, layer.width, layer.height / 2]);
    node.stroke(layer.stroke || layer.fill);
    node.strokeWidth(Math.max(1, layer.strokeWidth));
    return;
  }
  if (node instanceof Konva.Arrow) {
    node.points([0, layer.height, layer.width / 2, 0, layer.width, layer.height]);
    node.stroke(layer.stroke || layer.fill);
    node.strokeWidth(Math.max(1, layer.strokeWidth));
    return;
  }
  // 星形：sceneFunc 闭包内已绑定尺寸，仅在类型切换时重建，这里只同步配色
  node.setAttr('fill', layer.fill || undefined);
  node.setAttr('stroke', layer.strokeWidth > 0 ? layer.stroke : undefined);
  node.setAttr('strokeWidth', layer.strokeWidth);
}
