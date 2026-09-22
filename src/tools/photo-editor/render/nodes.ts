import Konva from 'konva';
import { bakeSignature } from '../core';
import { getCanvas } from '../model/assets';
import { bakeRaster } from './filters';
import { starPath } from './paint';
import type { Layer, ShapeLayer, TextLayer } from '../model/types';

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

/** 返回值统一为 `Konva.Shape`：Konva 的 `Layer.add` 只接受 Shape / Group */
export function createLayerNode(layer: Layer): Konva.Shape {
  const node: Konva.Shape =
    layer.kind === 'raster'
      ? createRasterNode(layer)
      : layer.kind === 'text'
        ? createTextNode(layer)
        : createShapeNode(layer);
  node.setAttr(LAYER_ID_ATTR, layer.id);
  // 形状按具体图形区分：更换图形类型时必须重建节点
  node.setAttr(LAYER_KIND_ATTR, layer.kind === 'shape' ? `shape:${layer.shape}` : layer.kind);
  if (layer.kind === 'raster') node.setAttr(BAKE_KEY_ATTR, bakeKeyOf(layer));
  applyCommon(node, layer);
  return node;
}

/** 就地更新：类型未变时只改属性，避免整树重建导致闪烁 */
export function updateLayerNode(node: Konva.Node, layer: Layer): void {
  if (layer.kind === 'raster' && node instanceof Konva.Image) {
    const asset = getCanvas(layer.assetId);
    const key = bakeKeyOf(layer);
    if (asset && node.getAttr(BAKE_KEY_ATTR) !== key) {
      node.image(bakeRaster(asset, key, layer.adjustments, layer.filters));
      node.setAttr(BAKE_KEY_ATTR, key);
    }
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

function applyCommon(node: Konva.Node, layer: Layer): void {
  node.position({ x: layer.x, y: layer.y });
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
