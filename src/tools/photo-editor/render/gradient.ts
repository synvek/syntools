import { traceSelection, withAlpha } from '../core';
import type { GradientKind, GradientMode } from '../core';
import { getCanvas } from '../model/assets';
import type { RasterLayer, Selection } from '../model/types';

/**
 * 渐变工具：在图层位图上从 A 拖到 B 生成线性 / 径向渐变。
 *
 * 落点是「一次拖拽 = 一次历史」，因此这里只负责把结果画上去；
 * 提交历史 / 失效烘焙缓存由调用方（`interaction/pointer.ts`）处理。
 */

export interface GradientOptions {
  kind: GradientKind;
  mode: GradientMode;
  /** 起点（文档坐标） */
  from: { x: number; y: number };
  /** 终点（文档坐标）；径向渐变中它到起点的距离即半径 */
  to: { x: number; y: number };
  foreground: string;
  background: string;
  selection: Selection | null;
  lockAlpha?: boolean;
}

/** 端点颜色：前景→透明 / 前景→背景 */
export function gradientColors(
  mode: GradientMode,
  foreground: string,
  background: string,
): [string, string] {
  if (mode === 'fg-bg') return [foreground, background];
  return [foreground, withAlpha(foreground, 0)];
}

export function applyGradient(layer: RasterLayer, options: GradientOptions): boolean {
  const asset = getCanvas(layer.assetId);
  if (!asset) return false;
  const ctx = asset.getContext('2d');
  if (!ctx) return false;
  const sx = asset.width / Math.max(1, layer.width);
  const sy = asset.height / Math.max(1, layer.height);

  const [start, end] = gradientColors(options.mode, options.foreground, options.background);
  const distance = Math.hypot(options.to.x - options.from.x, options.to.y - options.from.y);
  // 起终点重合时退化成一个点：用 1px 兜底，避免 createLinearGradient 抛错
  const span = Math.max(1, distance);

  ctx.save();
  ctx.scale(sx, sy);
  ctx.translate(-layer.x, -layer.y);
  if (options.selection) {
    traceSelection(ctx, options.selection);
    ctx.clip('nonzero');
  }
  ctx.globalCompositeOperation = options.lockAlpha ? 'source-atop' : 'source-over';

  let gradient: CanvasGradient;
  if (options.kind === 'radial') {
    gradient = ctx.createRadialGradient(
      options.from.x,
      options.from.y,
      0,
      options.from.x,
      options.from.y,
      span,
    );
  } else {
    gradient = ctx.createLinearGradient(options.from.x, options.from.y, options.to.x, options.to.y);
  }
  gradient.addColorStop(0, start);
  gradient.addColorStop(1, end);
  ctx.fillStyle = gradient;
  ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
  ctx.restore();
  return true;
}
