import { traceSelection, withAlpha } from '../core';
import type { GradientKind, GradientMode } from '../core';
import { getCanvas } from '../model/assets';
import type { RasterLayer, Selection } from '../model/types';

/**
 * Gradient tool: drag from A to B on a layer bitmap to create a linear / radial gradient.
 *
 * The rule is "one drag = one history entry", so this module only paints the result;
 * committing history / invalidating the bake cache is the caller's job (`interaction/pointer.ts`).
 */

export interface GradientOptions {
  kind: GradientKind;
  mode: GradientMode;
  /** Start point (document coordinates) */
  from: { x: number; y: number };
  /** End point (document coordinates); for a radial gradient its distance to the start is the radius */
  to: { x: number; y: number };
  foreground: string;
  background: string;
  selection: Selection | null;
  lockAlpha?: boolean;
}

/** Endpoint colors: foreground → transparent / foreground → background */
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
  // Coincident start and end degenerate to a point: pad to 1px so createLinearGradient does not throw
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
