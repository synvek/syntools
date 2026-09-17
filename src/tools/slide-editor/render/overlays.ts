import Konva from 'konva';
import type { Guide } from '../core';

/**
 * 画布覆盖层：变换控件（Transformer）、对齐参考线、框选矩形。
 * Transformer 与参考线放在已缩放的内容层内，坐标即页面坐标；
 * 框选矩形放在未缩放的覆盖层内，坐标即 stage 坐标。
 */

export interface TransformerOptions {
  onTransformEnd: (change: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  }) => void;
}

export function createTransformer(
  contentLayer: Konva.Layer,
  options: TransformerOptions,
): Konva.Transformer {
  const transformer = new Konva.Transformer({
    rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
    keepRatio: false,
    flipEnabled: false,
    ignoreStroke: true,
    boundBoxFunc: (oldBox, newBox) => {
      if (Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 8) return oldBox;
      return newBox;
    },
    anchorSize: 9,
    borderStroke: '#2563EB',
    anchorStroke: '#2563EB',
    anchorFill: '#FFFFFF',
  });
  transformer.on('transformend', () => {
    const node = transformer.nodes()[0];
    if (!node) return;
    options.onTransformEnd({
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      width: Math.round(node.width() * Math.abs(node.scaleX())),
      height: Math.round(node.height() * Math.abs(node.scaleY())),
      rotation: Math.round(node.rotation()),
    });
  });
  contentLayer.add(transformer);
  return transformer;
}

/** 参考线：以虚线绘制在页面坐标系内 */
export function drawGuides(
  contentLayer: Konva.Layer,
  guides: Guide[],
  size: { width: number; height: number },
): void {
  const group = contentLayer.findOne<Konva.Group>(`#guides`);
  if (group) group.destroy();
  if (guides.length === 0) return;
  const next = new Konva.Group({ id: 'guides', listening: false });
  for (const guide of guides) {
    const line = new Konva.Line({
      points:
        guide.axis === 'x'
          ? [guide.position, 0, guide.position, size.height]
          : [0, guide.position, size.width, guide.position],
      stroke: '#F43F5E',
      strokeWidth: 1 / Math.max(0.1, contentLayer.scaleX()),
      dash: [4, 4],
      listening: false,
    });
    next.add(line);
  }
  contentLayer.add(next);
}

export function clearGuides(contentLayer: Konva.Layer): void {
  const group = contentLayer.findOne<Konva.Group>(`#guides`);
  if (group) group.destroy();
}

/** 框选矩形（stage 坐标系） */
export function createMarquee(overlayLayer: Konva.Layer): Konva.Rect {
  const rect = new Konva.Rect({
    fill: 'rgba(37, 99, 235, 0.12)',
    stroke: '#2563EB',
    strokeWidth: 1,
    dash: [4, 4],
    visible: false,
    listening: false,
  });
  overlayLayer.add(rect);
  return rect;
}

export function updateMarquee(
  rect: Konva.Rect,
  box: { x: number; y: number; width: number; height: number } | null,
): void {
  if (!box) {
    rect.visible(false);
    return;
  }
  rect.setAttrs({ ...box, visible: true });
}
