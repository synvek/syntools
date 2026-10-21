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
 * 图层 → Konva 节点工厂。
 *
 * 每个节点带 `layerId` / `layerKind` / `bakeKey` 三个自定义属性，
 * `sync.ts` 据此决定「就地更新」还是「销毁重建」。
 */

export const LAYER_ID_ATTR = 'layerId';
export const LAYER_KIND_ATTR = 'layerKind';
export const BAKE_KEY_ATTR = 'bakeKey';
/** 变形文字的位图（挂在节点上，避免 sceneFunc 闭包捕获过期图层） */
const TEXT_BITMAP_ATTR = 'textBitmap';

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
  // 带蒙版 / 图层样式：整体先合成为一张图（两者都必须作用在「该图层自己的像素」上），
  // 复用与导出完全相同的 `composedLayerCanvas`，预览与产物不会再漂移。
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
  // 网格变形（无蒙版 / 样式时走这里；有蒙版 / 样式时上面的合成分支已把变形包含在内）
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
      // 按「缓冲左上角」落位：与合成路径同一套变换（绕包围盒中心旋转 / 翻转）
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
  // 形状按具体图形区分：更换图形类型时必须重建节点
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
          ? // live 传签名：预览走降采样，同时把「停手后算全分辨率」的任务交给 Worker
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
    // 变形 / 段间距：位图按签名缓存，同步时重新取一次只会命中缓存（除非参数真的变了）
    node.setAttr(TEXT_BITMAP_ATTR, textBitmap(layer));
  } else if (layer.kind === 'shape') {
    updateShapeNode(node, layer);
  }
  applyCommon(node, layer);
}

/**
 * 同步节点的位置与变换。
 *
 * `composed`（离屏合成结果 / 编组）必须用「以图层包围盒中心为轴」的写法（position = 中心 + offset = 中心到缓冲左上角），
 * 才能与 Canvas2D 的 `applyTransform`（绕包围盒中心旋转 / 翻转）逐像素对齐；
 * 普通节点仍按左上角落位，保持既有行为。
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
  // Konva 的 source-over 即「正常」；其余混合模式名与 Canvas2D 一致
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

/**
 * 文字节点。
 *
 * 两条路径：
 * - 常规文字 → `Konva.Text`（可缩放清晰、随时改字体）；
 * - 变形 / 带段间距 → `Konva.Shape` + 位图（`render/warp.ts`），与导出所用的 Canvas2D 同源。
 * 位图挂在节点属性上而不是闭包里捕获图层对象 —— 闭包会让节点永远画旧数据。
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
      // 不用 Konva.Ellipse：它的 x / y 表示**圆心**，而 applyCommon 会把节点 position 统一设成
      // 图层左上角，结果椭圆被画到 (x−w/2, y−h/2) 去（笔迹整体往左上偏半个身位）。
      // 统一用 sceneFunc 在节点局部坐标里落图，导出（Canvas2D）也是同一套坐标。
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
        // 按节点自身尺寸绘制（不是闭包里的 layer），缩放 / 变形后才会跟着刷新
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
  // Arrow 继承自 Line，必须先判箭头，否则会被当成普通直线重设 points
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
  // 椭圆 / 星形：sceneFunc 按节点自身尺寸绘制，这里同步尺寸与配色
  node.width(layer.width);
  node.height(layer.height);
  node.setAttr('fill', layer.fill || undefined);
  node.setAttr('stroke', layer.strokeWidth > 0 ? layer.stroke : undefined);
  node.setAttr('strokeWidth', layer.strokeWidth);
}
