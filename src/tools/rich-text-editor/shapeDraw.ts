/**
 * 画布拖拽绘制的几何（Word / Excel 的"点形状按钮 → 在工作区拉一个框"）。
 *
 * 纯函数放在这里而不是组件里：拖拽结束要落多少像素、多小算"单击"、负方向拖拽怎么归一化，
 * 都是会被三个编辑器共用的规则，也才测得到（jsdom 里模拟 pointer 序列没有意义）。
 */

/** 小于这个尺寸的形状看不见手柄，视为误触，按默认尺寸插入 */
export const MIN_DRAW_SIZE = 20;

/** 位移小于这个像素视为"单击"，不是拖拽 */
export const CLICK_SLOP = 4;

export interface DrawRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 归一化拖拽矩形：支持向左/向上拉，坐标取整，尺寸不小于 MIN_DRAW_SIZE */
export function drawRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  minSize: number = MIN_DRAW_SIZE,
): DrawRect {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.max(minSize, Math.round(Math.abs(endX - startX))),
    height: Math.max(minSize, Math.round(Math.abs(endY - startY))),
  };
}

/** 是否只是点了一下（没拖动）：此时按默认尺寸插入 */
export function isClickGesture(dx: number, dy: number, slop: number = CLICK_SLOP): boolean {
  return Math.abs(dx) < slop && Math.abs(dy) < slop;
}

/** 屏幕像素 → 文档像素（画布可能被 CSS zoom 缩放） */
export function toCanvasPx(screenDelta: number, zoom: number): number {
  const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return screenDelta / scale;
}
