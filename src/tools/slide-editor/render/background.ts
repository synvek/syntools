import type { RectConfig } from 'konva/lib/shapes/Rect';
import { normalizeBackground } from '../core';
import type { SlideBackground } from '../model/types';

/**
 * Slide background → Konva fill props.
 *
 * Since v2 backgrounds support linear gradients, and canvas / thumbnail / presentation / raster export all
 * render it, this lives in one pure function instead of repeating the angle math in four places.
 *
 * Angular convention matches PowerPoint: 0° left→right, 90° top→bottom, 180° right→left, 270° bottom→top.
 */

/** Gradient direction vector → start/end points on the bounding box */
function gradientEnds(
  angle: number,
  width: number,
  height: number,
): [{ x: number; y: number }, { x: number; y: number }] {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  // Projected length of the direction line onto the bounding box
  const length = Math.abs(width * dx) + Math.abs(height * dy);
  const cx = width / 2;
  const cy = height / 2;
  return [
    { x: cx - (dx * length) / 2, y: cy - (dy * length) / 2 },
    { x: cx + (dx * length) / 2, y: cy + (dy * length) / 2 },
  ];
}

/**
 * Build the fill config for a Konva.Rect.
 *
 * - solid / default → `{ fill }`
 * - gradient → the `fillLinearGradient*` trio
 * - no fill → `{ fill: 'transparent' }` (the node is still needed to cover the page area)
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
