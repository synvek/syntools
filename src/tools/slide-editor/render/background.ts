import type { RectConfig } from 'konva/lib/shapes/Rect';
import { normalizeBackground } from '../core';
import type { SlideBackground } from '../model/types';

/**
 * 页面背景 → Konva 填充属性。
 *
 * v2 起背景支持线性渐变，画布 / 缩略图 / 放映 / 光栅导出四处都要渲染背景，
 * 抽成同一个纯函数避免四处各写一遍角度换算。
 *
 * 角度约定与 PowerPoint 一致：0° 左→右，90° 上→下，180° 右→左，270° 下→上。
 */

/** 渐变方向向量 → 包围盒上的起点/终点 */
function gradientEnds(
  angle: number,
  width: number,
  height: number,
): [{ x: number; y: number }, { x: number; y: number }] {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  // 方向线在包围盒上的投影长度
  const length = Math.abs(width * dx) + Math.abs(height * dy);
  const cx = width / 2;
  const cy = height / 2;
  return [
    { x: cx - (dx * length) / 2, y: cy - (dy * length) / 2 },
    { x: cx + (dx * length) / 2, y: cy + (dy * length) / 2 },
  ];
}

/**
 * 生成 Konva.Rect 的填充配置。
 *
 * - 纯色 / 缺省 → `{ fill }`
 * - 渐变 → `fillLinearGradient*` 三件套
 * - 无填充 → `{ fill: 'transparent' }`（仍需要节点来兜住页面范围）
 */
export function backgroundFillProps(
  bg: SlideBackground | undefined,
  width: number,
  height: number,
  fallback = '#FFFFFF',
): RectConfig {
  const fill = normalizeBackground(bg);
  if (!fill || fill.type === 'none') return { fill: 'transparent' };
  if (fill.type === 'solid') return { fill: fill.color };

  const stops = fill.stops.length > 0 ? fill.stops : [{ offset: 0, color: fallback }];
  const [start, end] = gradientEnds(fill.angle ?? 0, width, height);
  const colorStops: (number | string)[] = [];
  for (const stop of [...stops].sort((a, b) => a.offset - b.offset)) {
    colorStops.push(Math.min(1, Math.max(0, stop.offset)), stop.color);
  }
  return {
    fillLinearGradientStartPoint: start,
    fillLinearGradientEndPoint: end,
    fillLinearGradientColorStops: colorStops,
  };
}
