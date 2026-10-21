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
 * 2D 上下文绘制层：把任意图层（位图 / 文字 / 形状）画到 Canvas2D 上。
 *
 * 导出、拼合、缩略图共用本模块，保证预览与产物一致；Konva 只负责交互与实时预览。
 *
 * 关键约定：**蒙版与图层样式都必须作用在「图层自己的像素」上**，
 * 因此这两类图层要先离屏合成（`composedLayerCanvas`）再整体绘制。
 * 该分支对预览（Konva 用同一张合成结果做 Image）与导出（`compositeLayers` → `paintLayer`）是同一条代码路径，
 * 从根上避免「预览有蒙版、导出没有」这类双管线漂移。
 */

export interface PaintOptions {
  /** 位图烘焙结果缓存键前缀（默认按文档烘焙；缩略图可传自己的前缀避免互相覆盖） */
  signaturePrefix?: string;
  /** 文档：编组整体合成 / 蒙版与样式合成需要它来取组内子树与文档尺寸 */
  doc?: PhotoDoc;
  /** 剪贴蒙版的基准图层（由 `compositeLayers` / Konva 节点传入） */
  clipBase?: Layer | null;
}

/**
 * 图层是否需要「先离屏合成再整体绘制」：
 * 像素蒙版 / 矢量蒙版 / 图层样式 / 剪贴蒙版都要求先拿到「图层自己的像素」。
 */
export function layerNeedsComposite(layer: Layer): boolean {
  return (
    Boolean(layer.mask?.enabled) ||
    hasVectorMask(layer.vectorMask) ||
    hasLayerStyle(layer.style) ||
    Boolean(layer.clipped) ||
    // 智能滤镜：烘焙结果不等于「源像素缩放」，必须走离屏合成
    (layer.kind === 'smart' && hasActiveFilters(layer.filters))
  );
}

/** 合成缓冲相对图层包围盒的留白（图层样式向外扩散的范围） */
export function composedLayerPadding(layer: Layer): number {
  // 网格变形会把内容甩出盒子，留白必须一并算上，否则合成缓冲会把变形结果裁掉
  return stylePadding(layer.style) + meshPadding(layer.mesh, layer.width, layer.height);
}

/** 合成缓冲左上角对应的文档坐标 */
export function composedLayerOrigin(layer: Layer): { x: number; y: number } {
  const pad = composedLayerPadding(layer);
  return { x: layer.x - pad, y: layer.y - pad };
}

/**
 * 合成签名：蒙版 / 矢量蒙版 / 样式 / 剪贴蒙版任一变化都应让 Konva 重建这张图。
 * `clipKey` 由调用方给出（含基准图层的 id 与内容版本），保证基准变了剪贴结果也会刷新。
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
 * 基准图层的内容签名：只有它的**轮廓**变化才会改变剪贴结果，
 * 因此只纳入像素版本 / 蒙版 / 文本内容，不含透明度与混合模式。
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

/** 查出某个图层的剪贴基准（同层内下方最近的可绘制图层） */
export function clipBaseOf(doc: PhotoDoc, layer: Layer): Layer | null {
  const index = doc.layers.findIndex((item) => item.id === layer.id);
  if (index < 0) return null;
  const baseIndex = clipBaseIndex(doc.layers, index);
  return baseIndex >= 0 ? doc.layers[baseIndex] : null;
}

/** 图层内容 + 自身蒙版（像素 / 矢量），不含样式与透明度 —— 单独抽出以复用为剪贴基准的形状 */
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

/** 把图层自己的两种蒙版作用到画布上（像素蒙版 → 矢量蒙版） */
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
 * 把「图层内容 + 两种蒙版 + 剪贴蒙版 + 图层样式」压成一张画布
 * （比图层包围盒四周多 `stylePadding` 的留白）。
 *
 * 绘制顺序：内容 → 像素蒙版 → 矢量蒙版 → 图层样式 → 剪贴蒙版。
 * 剪贴放在最后，与 Photoshop 一致：整层（含效果）都被基准图层的 alpha 裁切。
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
      // 只保留基准图层的 alpha（形状），再用它裁切本层
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
 * 图层内容本身（不含图层透明度 / 混合模式 / 旋转翻转 —— 这些由 `paintLayer` 施加）。
 * 单独暴露是为了让样式合成能拿到「未加样式的原始剪影」。
 */
/**
 * 网格变形的缓存键：必须覆盖一切会改变「未变形像素」的因素。
 *
 * 位图缓存发生在**未变形**的局部空间，因此位置 / 旋转 / 翻转 / 不透明度这些不影响像素的字段要排除掉，
 * 否则拖动图层时每帧都会重建一张位图。
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
  // 网格变形（透视 / 扭曲 / 斜切 / 变形）：先按常规方式画到离屏画布，再按网格重采样。
  // 与文字变形同一策略：预览与导出共用同一张位图，两条管线不会漂移。
  const meshBitmap = meshLayerBitmap(
    layer,
    meshContentKey(layer, options.signaturePrefix),
    (inner, box) => {
      // 回调内以「网格已置空」的图层绘制，避免再次进入本分支造成递归
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
    // 穿透模式下子图层由调用方逐个绘制；否则整体合成后再绘制
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
        // 智能滤镜作用在「呈现尺寸」上：先缩放到当前尺寸再烘焙，
        // 这样放大 / 缩小智能对象时模糊半径等参数不会跟着一起缩放。
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
  // adjustment 由 render/composite.ts 在「作用于下方合成结果」时处理
}

/**
 * 按文档顺序绘制全部图层（导出 / 拼合的主体）。
 *
 * 走与画布预览同一条 `compositeLayers` 管线，编组整体合成、蒙版、调整图层才不会被漏掉——
 * 否则「预览正确、导出少一层调整」这类不一致很难排查。
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
 * 文字绘制。
 *
 * 常规文字直接落到 Canvas2D（`render/text.ts`，与预览共用同一份排版逻辑）；
 * 变形 / 带段间距的文字先由 `render/warp.ts` 生成位图再整体贴入 —— 与预览走的是同一张位图，
 * 因此「画布上看到什么，导出就是什么」。
 */
function paintText(ctx: CanvasRenderingContext2D, layer: Extract<Layer, { kind: 'text' }>): void {
  const bitmap = textBitmap(layer);
  if (bitmap) {
    ctx.drawImage(bitmap.canvas, layer.x + bitmap.offsetX, layer.y + bitmap.offsetY);
    return;
  }
  drawText(ctx, layer);
}

/** 文字换行：CJK 逐字断行、拉丁按空格断词（实现见 `render/text.ts`，此处再导出保持既有引用可用） */
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
      // 直线走「拖拽框的对角线」：拖出一个框就得到框内的一条斜线，
      // 与矩形 / 箭头 / 星形一样，笔迹不会超脱框外（原先固定画在竖向中线上）
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
