import Konva from 'konva';
import type { Guide } from '../core';

/**
 * 画布覆盖层：变换控件（Transformer）、对齐参考线、框选矩形。
 * Transformer 与参考线放在已缩放的内容层内，坐标即页面坐标；
 * 框选矩形放在未缩放的覆盖层内，坐标即 stage 坐标。
 */

export interface TransformChange {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface TransformerOptions {
  /** 多选时返回全部受影响元素的落点，调用方需逐个写回（否则未写回的元素会在下次 sync 复位） */
  onTransformEnd: (changes: TransformChange[]) => void;
}

/** Shift 键状态：按下时 Transformer 走等比缩放（与 PowerPoint / WPS 一致） */
let shiftHeld = false;
let shiftBound = false;
function bindShiftTracker(): void {
  if (shiftBound || typeof window === 'undefined') return;
  shiftBound = true;
  const sync = (event: KeyboardEvent) => {
    shiftHeld = event.shiftKey;
  };
  window.addEventListener('keydown', sync);
  window.addEventListener('keyup', sync);
  window.addEventListener('blur', () => {
    shiftHeld = false;
  });
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
    // 多选时逐个节点取出落点：Konva 已把群组变换应用到每个成员节点上
    const changes: TransformChange[] = [];
    for (const node of transformer.nodes()) {
      if (!node.id()) continue;
      changes.push({
        id: node.id(),
        x: Math.round(node.x()),
        y: Math.round(node.y()),
        width: Math.round(node.width() * Math.abs(node.scaleX())),
        height: Math.round(node.height() * Math.abs(node.scaleY())),
        rotation: Math.round(node.rotation()),
      });
    }
    if (changes.length > 0) options.onTransformEnd(changes);
  });
  bindShiftTracker();
  // 变换过程中持续跟随 Shift：按住等比、松开自由，无需重新进入变换
  transformer.on('transformstart transform', () => {
    transformer.keepRatio(shiftHeld);
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

/** 手动参考线：蓝色实线 + 端点小方块，与拖拽时的红色虚线区分 */
export function drawCustomGuides(
  contentLayer: Konva.Layer,
  guides: { id: string; axis: 'x' | 'y'; position: number }[],
  size: { width: number; height: number },
): void {
  const existing = contentLayer.findOne<Konva.Group>(`#customGuides`);
  if (existing) existing.destroy();
  if (guides.length === 0) return;
  const scale = Math.max(0.1, contentLayer.scaleX());
  const width = 1 / scale;
  const next = new Konva.Group({ id: 'customGuides', listening: false });
  for (const guide of guides) {
    const points =
      guide.axis === 'x'
        ? [guide.position, 0, guide.position, size.height]
        : [0, guide.position, size.width, guide.position];
    next.add(
      new Konva.Line({
        points,
        stroke: '#0EA5E9',
        strokeWidth: width,
        dash: [6 / scale, 4 / scale],
        listening: false,
      }),
    );
  }
  contentLayer.add(next);
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
