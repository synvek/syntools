import { MAX_STAMPS_PER_MOVE, pointInSelection, stampFalloff, walkStamps } from '../core';
import { getCanvas } from '../model/assets';
import type { Selection } from '../model/types';

/**
 * 印章会话：润饰工具族（减淡 / 加深 / 海绵 / 图章 / 修复 / 涂抹 / 模糊锐化）的公共骨架。
 *
 * 负责三件容易写错的事：文档坐标 → 画布像素的换算、沿笔迹的等距步进、压感归一。
 * 「每枚印章做什么」交给调用方的 `onStamp`，因此各类工具只需要关心自己的像素运算。
 *
 * 性能约定：每枚印章只 `getImageData` 它自己的包围盒（脏矩形），大图上也不至于整层重算。
 */

export interface StampHost {
  assetId: string;
  /** 文档坐标下的左上角与尺寸（与画布像素尺寸的比值即缩放） */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StampFrame {
  /** 画布像素坐标下的印章包围盒 */
  left: number;
  top: number;
  width: number;
  height: number;
  /** 包围盒像素数据（就地修改后由 `put` 写回） */
  data: Uint8ClampedArray;
  /** 取该像素的笔头权重（圆外 / 选区外为 0），`index` 为像素序号（非字节偏移） */
  weightAt: (index: number) => number;
  /** 画布像素坐标 */
  pixelAt: (index: number) => { x: number; y: number };
  /** 写回包围盒（仅当确实改动过时调用） */
  put: () => void;
}

export interface StampContext {
  /** 文档坐标 */
  x: number;
  y: number;
  /** 0~1 归一压感 */
  pressure: number;
  /** 是否为本笔画的第一个印章（图章类的源点偏移以此确定） */
  first: boolean;
}

export interface StampSessionOptions {
  /** 文档坐标下的笔头直径 */
  size: number;
  /** 间距（相对直径） */
  spacing: number;
  selection: Selection | null;
  /** 每枚印章返回 true 表示像素有改动 */
  onStamp: (frame: StampFrame, context: StampContext) => boolean;
}

export interface StampSession {
  /** `pressure` 缺省按 1 处理 */
  move: (x: number, y: number, pressure?: number) => void;
  end: () => void;
}

const MIN_PRESSURE = 0.05;

function normalizePressure(pressure: number | undefined): number {
  if (pressure === undefined || !Number.isFinite(pressure) || pressure <= 0) return 1;
  return Math.max(MIN_PRESSURE, Math.min(1, pressure));
}

export function createStampSession(
  host: StampHost,
  options: StampSessionOptions,
): StampSession | null {
  const asset = getCanvas(host.assetId);
  if (!asset) return null;
  const ctx = asset.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const sx = asset.width / Math.max(1, host.width);
  const sy = asset.height / Math.max(1, host.height);
  const radiusDoc = Math.max(0.5, options.size / 2);
  const step = Math.max(0.5, options.size * options.spacing);

  let last: { x: number; y: number } | null = null;
  let travelled = step;
  let first = true;

  const stamp = (docX: number, docY: number, pressure: number) => {
    const cx = (docX - host.x) * sx;
    const cy = (docY - host.y) * sy;
    const rx = radiusDoc * sx;
    const ry = radiusDoc * sy;
    const left = Math.max(0, Math.floor(cx - rx));
    const top = Math.max(0, Math.floor(cy - ry));
    const right = Math.min(asset.width, Math.ceil(cx + rx));
    const bottom = Math.min(asset.height, Math.ceil(cy + ry));
    const width = right - left;
    const height = bottom - top;
    if (width <= 0 || height <= 0) {
      first = false;
      return;
    }
    const frame = ctx.getImageData(left, top, width, height);
    const selection = options.selection;
    const weightAt = (index: number) => {
      const px = left + (index % width);
      const py = top + Math.floor(index / width);
      const distance = Math.hypot((px + 0.5 - cx) / rx, (py + 0.5 - cy) / ry);
      if (distance >= 1) return 0;
      if (selection && !pointInSelection(selection, host.x + px / sx, host.y + py / sy)) return 0;
      return stampFalloff(distance);
    };
    const context: StampContext = { x: docX, y: docY, pressure, first };
    first = false;
    const changed = options.onStamp(
      {
        left,
        top,
        width,
        height,
        data: frame.data,
        weightAt,
        pixelAt: (index) => ({
          x: left + (index % width),
          y: top + Math.floor(index / width),
        }),
        put: () => ctx.putImageData(frame, left, top),
      },
      context,
    );
    if (changed) ctx.putImageData(frame, left, top);
  };

  return {
    move: (x, y, pressure) => {
      const value = normalizePressure(pressure);
      if (!last) {
        // 单击（未拖动）也要留下一枚印章
        stamp(x, y, value);
        last = { x, y };
        travelled = step;
        return;
      }
      const result = walkStamps(last.x, last.y, x, y, step, travelled);
      for (const position of result.positions) stamp(position.x, position.y, value);
      // 极端跳点被截断时直接对齐到当前点，避免后续印章全部落在旧轨迹上
      travelled = result.positions.length >= MAX_STAMPS_PER_MOVE ? step : result.next;
      last = { x, y };
    },
    end: () => {
      last = null;
      first = true;
    },
  };
}
