import { bakeSignature } from '../core';
import { getCanvas } from '../model/assets';
import { compositeLayers, groupComposite } from './composite';
import { bakeRaster } from './filters';
import type { Layer, PhotoDoc, ShapeKind } from '../model/types';

/**
 * 2D 上下文绘制层：把任意图层（位图 / 文字 / 形状）画到 Canvas2D 上。
 *
 * 导出、拼合、缩略图共用本模块，保证预览与产物一致；Konva 只负责交互与实时预览。
 */

export interface PaintOptions {
  /** 位图烘焙结果缓存键前缀（默认按文档烘焙；缩略图可传自己的前缀避免互相覆盖） */
  signaturePrefix?: string;
  /** 文档：编组整体合成需要它来取组内子树 */
  doc?: PhotoDoc;
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
    if (source) ctx.drawImage(source, layer.x, layer.y, layer.width, layer.height);
  }
  // adjustment 由 render/composite.ts 在「作用于下方合成结果」时处理
  ctx.restore();
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

function paintText(ctx: CanvasRenderingContext2D, layer: Extract<Layer, { kind: 'text' }>): void {
  const style = [
    layer.italic ? 'italic' : 'normal',
    layer.bold ? 'bold' : 'normal',
    `${layer.fontSize}px`,
    `${layer.fontFamily}, sans-serif`,
  ].join(' ');
  ctx.font = style;
  ctx.fillStyle = layer.fill;
  ctx.textBaseline = 'top';
  ctx.textAlign = layer.align === 'center' ? 'center' : layer.align === 'right' ? 'right' : 'left';
  const lineHeight = layer.fontSize * layer.lineHeight;
  const lines = wrapText(ctx, layer.text, layer.width);
  const anchorX =
    layer.align === 'center'
      ? layer.x + layer.width / 2
      : layer.align === 'right'
        ? layer.x + layer.width
        : layer.x;
  lines.forEach((line, index) => {
    ctx.fillText(line, anchorX, layer.y + index * lineHeight);
    if (layer.underline) {
      const width = ctx.measureText(line).width;
      const startX =
        layer.align === 'center'
          ? anchorX - width / 2
          : layer.align === 'right'
            ? anchorX - width
            : anchorX;
      ctx.fillRect(
        startX,
        layer.y + (index + 1) * lineHeight - 2,
        width,
        Math.max(1, layer.fontSize / 14),
      );
    }
  });
}

/** CJK 标点 / 假名 / 汉字 / 全角区间：这些字符逐字断行（用转义区间，避免源码出现全角空白） */
const CJK_PATTERN = new RegExp(
  '[\\u2E80-\\u9FFF\\uF900-\\uFAFF\\uFF00-\\uFFEF\\u3000-\\u303F\\u3040-\\u30FF]',
);

/** 文本换行：CJK 逐字断行，拉丁按空格断词 */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let current = '';
    let token = '';
    for (const char of paragraph) {
      // CJK 标点 / 假名 / 汉字 / 全角区间：逐字断行（用转义区间避免源码里出现全角空白）
      const isCjk = CJK_PATTERN.test(char);
      const piece = isCjk ? char : char === ' ' ? ' ' : char;
      const candidate = token + piece;
      if (!isCjk && piece !== ' ') {
        token = candidate;
        continue;
      }
      const next = current + candidate;
      if (ctx.measureText(next).width > maxWidth && current.length > 0) {
        lines.push(current);
        current = isCjk ? char : '';
        token = '';
        continue;
      }
      current = next;
      token = '';
    }
    if (token) {
      const next = current + token;
      if (ctx.measureText(next).width > maxWidth && current.length > 0) {
        lines.push(current);
        current = token;
      } else {
        current = next;
      }
    }
    lines.push(current);
  }
  return lines;
}

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
      ctx.moveTo(x, y + height / 2);
      ctx.lineTo(x + width, y + height / 2);
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
