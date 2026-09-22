import Konva from 'konva';
import type { PhotoDoc, Rect, Selection } from '../model/types';

/**
 * 覆盖层绘制：选区（蚂蚁线）、裁剪框（外部压暗 + 三分构图线）。
 * 全部 `listening: false`，只负责视觉，不参与命中检测。
 */

export function clearOverlay(layer: Konva.Layer): void {
  layer.destroyChildren();
}

/** 1 / scale：让线宽与虚线间隔在任意缩放下看起来一致 */
function hairline(scale: number): number {
  return 1 / Math.max(0.05, scale);
}

export function drawSelection(layer: Konva.Layer, selection: Selection, scale: number): void {
  const strokeWidth = hairline(scale);
  const dash = [6 * strokeWidth, 4 * strokeWidth];
  const shape =
    selection.kind === 'lasso'
      ? new Konva.Line({
          points: selection.path,
          closed: true,
          stroke: '#2563EB',
          strokeWidth,
          dash,
          dashOffset: 0,
        })
      : selection.kind === 'ellipse'
        ? new Konva.Ellipse({
            x: selection.x + selection.width / 2,
            y: selection.y + selection.height / 2,
            radiusX: selection.width / 2,
            radiusY: selection.height / 2,
            stroke: '#2563EB',
            strokeWidth,
            dash,
          })
        : new Konva.Rect({
            x: selection.x,
            y: selection.y,
            width: selection.width,
            height: selection.height,
            stroke: '#2563EB',
            strokeWidth,
            dash,
          });
  layer.add(shape);
  // 反色描边：在深色 / 浅色画面上都能看清蚂蚁线
  const ghost = shape.clone({ stroke: '#FFFFFF', dash: dash.slice().reverse(), opacity: 0.7 });
  layer.add(ghost);
}

export function drawCrop(layer: Konva.Layer, rect: Rect, doc: PhotoDoc, scale: number): void {
  const strokeWidth = hairline(scale);
  const mask = new Konva.Rect({
    x: 0,
    y: 0,
    width: doc.width,
    height: doc.height,
    fill: 'rgba(15, 23, 42, 0.55)',
  });
  layer.add(mask);

  // 挖出裁剪区：destination-out 把中间掏空，露出未压暗的画面
  const hole = new Konva.Rect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    fill: '#000000',
    globalCompositeOperation: 'destination-out',
  });
  layer.add(hole);

  const frame = new Konva.Rect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    stroke: '#FFFFFF',
    strokeWidth,
  });
  layer.add(frame);

  // 三分构图参考线
  for (let i = 1; i <= 2; i += 1) {
    layer.add(
      new Konva.Line({
        points: [
          rect.x + (rect.width * i) / 3,
          rect.y,
          rect.x + (rect.width * i) / 3,
          rect.y + rect.height,
        ],
        stroke: 'rgba(255,255,255,0.5)',
        strokeWidth: strokeWidth / 1.5,
        dash: [4 * strokeWidth, 4 * strokeWidth],
      }),
    );
    layer.add(
      new Konva.Line({
        points: [
          rect.x,
          rect.y + (rect.height * i) / 3,
          rect.x + rect.width,
          rect.y + (rect.height * i) / 3,
        ],
        stroke: 'rgba(255,255,255,0.5)',
        strokeWidth: strokeWidth / 1.5,
        dash: [4 * strokeWidth, 4 * strokeWidth],
      }),
    );
  }
}
