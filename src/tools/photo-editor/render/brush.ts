import { SPACING_LINE_THRESHOLD, clampSpacing, pointInSelection, traceSelection } from '../core';
import { createCanvasElement, getCanvas } from '../model/assets';
import type { RasterLayer, Rect, Selection } from '../model/types';

/**
 * Painting: write straight into the layer bitmap's 2D context.
 *
 * This path instead of "one Konva node per stroke" keeps long strokes from exploding the node count;
 * one stroke bumps `rev` once (invalidating the bake cache), so the undo granularity is one stroke.
 *
 * Two stroke shapes:
 * - **continuous stroke** (spacing ≤ 5%): `lineTo + stroke`, fastest and smoothest at the edges;
 * - **per-point stamping** (spacing > 5%): render the tip once into a sprite and `drawImage` it along the path,
 *   stepping by `spacing × diameter`, which conveys the grain of the spacing and lets each stamp take pressure.
 */

export interface StrokeOptions {
  color: string;
  /** Brush diameter in document units */
  size: number;
  /** 0~1: 1 gives a hard edge, smaller is softer */
  hardness: number;
  /** 0~1 */
  opacity: number;
  mode: 'brush' | 'eraser';
  selection: Selection | null;
  /** Lock transparent pixels: paint only on existing pixels (source-atop), never adding content */
  lockAlpha?: boolean;
  /** Stamp spacing (relative to the diameter), 0.1 by default */
  spacing?: number;
  /** Pressure modulates stroke size (needs device support; a mouse falls back to 1) */
  pressureSize?: boolean;
  /** Pressure modulates opacity */
  pressureOpacity?: boolean;
}

export interface StrokeSession {
  /** `pressure` is 0~1; when missing it is treated as 1 */
  move: (x: number, y: number, pressure?: number) => void;
  end: () => void;
}

/** Pressure floor: a mouse / device reporting 0 must still produce a visible stroke */
const MIN_PRESSURE = 0.15;

function normalizePressure(pressure: number | undefined): number {
  if (pressure === undefined || !Number.isFinite(pressure) || pressure <= 0) return 1;
  return Math.max(MIN_PRESSURE, Math.min(1, pressure));
}

/**
 * Pre-render the tip sprite: opaque at the center, falling off toward the edge by hardness.
 * When `hardness >= 1` it just fills a circle (canvas antialiasing gives the clean edge).
 */
function transparentOf(color: string): string {
  const hex = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) return `${hex}00`;
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}00`;
  }
  return 'rgba(0,0,0,0)';
}

function createStampSprite(color: string, hardness: number): HTMLCanvasElement {
  const size = 128;
  const canvas = createCanvasElement(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const radius = size / 2;
  if (hardness >= 0.995) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.fill();
    return canvas;
  }
  // Solid core radius follows hardness: hardness=1 → core ≈ radius; hardness=0 → core 0 (all falloff)
  const inner = Math.max(0, Math.min(0.98, hardness)) * radius;
  const gradient = ctx.createRadialGradient(radius, radius, inner, radius, radius, radius);
  gradient.addColorStop(0, color);
  // Fade to a transparent version of the same color, not transparent black: the latter passes through dark
  // red under premultiplied interpolation, and stacked tips would darken the middle of the stroke.
  gradient.addColorStop(1, transparentOf(color));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(radius, radius, radius, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

/** Scale from document coordinates to asset pixel coordinates */
function assetScale(layer: StrokeTarget): { sx: number; sy: number } | null {
  const asset = getCanvas(layer.assetId);
  if (!asset) return null;
  return {
    sx: asset.width / Math.max(1, layer.width),
    sy: asset.height / Math.max(1, layer.height),
  };
}

/**
 * Clip the current context to the selection (the context must already be translated into document space).
 * Everything uses nonzero: `traceSelection` already normalized outline directions for union / difference,
 * so the inverted "frame + holes" and the multi-outline results of boolean ops all clip correctly.
 */
function clipToSelection(ctx: CanvasRenderingContext2D, selection: Selection): void {
  traceSelection(ctx, selection);
  ctx.clip('nonzero');
}

/** Stamp cap per pointermove: keeps an extreme jump (e.g. a glitchy device) from painting thousands of stamps */
const MAX_STAMPS_PER_MOVE = 2048;

/**
 * Paint target: it only needs "a canvas plus where it sits and how big it is in the document".
 *
 * A structural type because strokes must also land on **layer masks** and the **quick mask**,
 * which are not `RasterLayer`s; `RasterLayer` satisfies this interface as-is, so callers need no changes.
 */
export interface StrokeTarget {
  assetId: string;
  /** Top-left in document coordinates */
  x: number;
  y: number;
  /** Size in document coordinates (its ratio to the canvas pixel size is the scale) */
  width: number;
  height: number;
}

export function createStrokeSession(
  layer: StrokeTarget,
  options: StrokeOptions,
): StrokeSession | null {
  const asset = getCanvas(layer.assetId);
  const scale = assetScale(layer);
  if (!asset || !scale) return null;
  const ctx = asset.getContext('2d');
  if (!ctx) return null;

  const spacing = clampSpacing(options.spacing ?? 0.1);
  const stamping = spacing > SPACING_LINE_THRESHOLD;
  const sprite = stamping ? createStampSprite(options.color, options.hardness) : null;
  const step = Math.max(0.75, options.size * spacing);

  /**
   * Two paint paths, decided by "does it have to go through a buffer":
   *
   * - **direct** (opacity = 1, i.e. almost every stroke): the stroke is painted into the layer bitmap.
   *   Pixels change immediately, so the per-frame canvas re-read shows the stroke, with no extra canvas.
   * - **buffered** (opacity < 1): the stroke is painted at alpha 1 into a separate buffer, then
   *   "pre-stroke snapshot + buffer composited at opacity" is written back. Overlapping stamps therefore
   *   don't darken each other, so opacity behaves as expected; the cost is a snapshot canvas per stroke.
   *
   * Hard requirement for both: **the bitmap must receive new pixels during the stroke itself**.
   * Canvas refresh re-reads the bitmap (`refreshLayerNode(..., live)`),
   * so an unchanged bitmap means no feedback — exactly what makes strokes appear only on release.
   */
  const direct = options.opacity >= 1;
  /** Buffered mode restores the target region from this each time (so it keeps the whole frame) */
  const base = direct ? null : createCanvasElement(asset.width, asset.height);
  const buffer = direct ? null : createCanvasElement(asset.width, asset.height);
  const baseCtx = base?.getContext('2d');
  if (!direct && (!base || !baseCtx || !buffer)) return null;
  if (baseCtx) baseCtx.drawImage(asset, 0, 0);

  const target = direct ? ctx : (buffer as HTMLCanvasElement).getContext('2d');
  if (!target) return null;
  target.save();
  target.scale(scale.sx, scale.sy);
  target.translate(-layer.x, -layer.y);
  // Selection clipping: direct mode clips inline; buffered mode clips at composite time (the buffer just accumulates)
  if (direct && options.selection) clipToSelection(target, options.selection);
  target.globalAlpha = direct ? options.opacity : 1;
  target.globalCompositeOperation = direct ? compositeOp(options) : 'source-over';
  target.lineCap = 'round';
  target.lineJoin = 'round';
  target.lineWidth = options.size;
  target.strokeStyle = options.color;
  target.fillStyle = options.color;
  const blurRadius = options.hardness < 1 ? options.size * (1 - options.hardness) * 0.6 : 0;
  if (!stamping && blurRadius > 0) {
    target.shadowColor = options.color;
    target.shadowBlur = blurRadius;
  }

  /** Region to recomposite (document coords); null = no stroke waiting to be composited */
  let dirty: { x0: number; y0: number; x1: number; y1: number } | null = null;
  const markDirty = (x: number, y: number, radius: number) => {
    // Shadow blur pushes the stroke past its geometry, so it has to be part of the dirty region
    const pad = radius + blurRadius + 2;
    const box = { x0: x - pad, y0: y - pad, x1: x + pad, y1: y + pad };
    dirty = dirty
      ? {
          x0: Math.min(dirty.x0, box.x0),
          y0: Math.min(dirty.y0, box.y0),
          x1: Math.max(dirty.x1, box.x1),
          y1: Math.max(dirty.y1, box.y1),
        }
      : box;
  };

  /**
   * Composite "snapshot + buffer" back into the bitmap.
   *
   * Only the dirty region is processed (release closes out the full frame): a full recomposite per frame
   * on a 4096² canvas wastes tens of megapixels; compositing is a pure function of the region, so results match.
   */
  const composite = (whole: boolean) => {
    if (direct || !base || !buffer) return;
    const region =
      whole || !dirty
        ? { x0: layer.x, y0: layer.y, x1: layer.x + layer.width, y1: layer.y + layer.height }
        : dirty;
    ctx.save();
    ctx.scale(scale.sx, scale.sy);
    ctx.translate(-layer.x, -layer.y);
    if (options.selection) clipToSelection(ctx, options.selection);
    ctx.beginPath();
    ctx.rect(region.x0, region.y0, region.x1 - region.x0, region.y1 - region.y0);
    ctx.clip();
    // Only 'copy' restores transparency exactly (source-over cannot paint transparent pixels back)
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(base, 0, 0);
    ctx.globalAlpha = options.opacity;
    ctx.globalCompositeOperation = compositeOp(options);
    ctx.drawImage(buffer, 0, 0);
    ctx.restore();
    dirty = null;
  };

  /** Stamp one tip with pressure: pressure modulates diameter and opacity */
  const stamp = (x: number, y: number, pressure: number) => {
    if (!sprite) return;
    const sizeFactor = options.pressureSize ? 0.25 + 0.75 * pressure : 1;
    const alphaFactor = options.pressureOpacity ? 0.2 + 0.8 * pressure : 1;
    const diameter = Math.max(0.5, options.size * sizeFactor);
    target.globalAlpha = (direct ? options.opacity : 1) * alphaFactor;
    target.drawImage(sprite, x - diameter / 2, y - diameter / 2, diameter, diameter);
    markDirty(x, y, diameter / 2);
  };

  let last: { x: number; y: number } | null = null;
  /** Travel left before the next stamp (accumulates across moves, keeping steps in sync with real movement) */
  let next = step;

  return {
    move: (x, y, pressure) => {
      const value = normalizePressure(pressure);

      if (stamping) {
        if (!last) {
          // A click (no drag) must still leave a dot
          stamp(x, y, value);
          last = { x, y };
          next = step;
          composite(false);
          return;
        }
        let dx = x - last.x;
        let dy = y - last.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 1e-6) return;
        dx /= distance;
        dy /= distance;
        let travelled = next;
        let count = 0;
        while (travelled <= distance && count < MAX_STAMPS_PER_MOVE) {
          stamp(last.x + dx * travelled, last.y + dy * travelled, value);
          travelled += step;
          count += 1;
        }
        next = Math.max(0, travelled - distance);
        last = { x, y };
        composite(false);
        return;
      }

      if (last) {
        target.beginPath();
        target.moveTo(last.x, last.y);
        target.lineTo(x, y);
        target.stroke();
        markDirty(last.x, last.y, options.size / 2);
        markDirty(x, y, options.size / 2);
      } else {
        target.beginPath();
        target.arc(x, y, Math.max(0.5, options.size / 2), 0, Math.PI * 2);
        target.fill();
        markDirty(x, y, options.size / 2);
      }
      last = { x, y };
      composite(false);
    },
    end: () => {
      last = null;
      if (direct) {
        ctx.restore();
        return;
      }
      // Close out the full frame: the dirty region only has to be "good enough", this guarantees consistency
      composite(true);
      target.restore();
      // Both temp canvases serve only this stroke, so free them now (tens of megabytes on a big canvas)
      base!.width = 0;
      base!.height = 0;
      buffer!.width = 0;
      buffer!.height = 0;
    },
  };
}

/** Paint compositing mode: erase / draw only on existing pixels (locked alpha) / normal over */
function compositeOp(options: StrokeOptions): GlobalCompositeOperation {
  if (options.mode === 'eraser') return 'destination-out';
  return options.lockAlpha ? 'source-atop' : 'source-over';
}

/**
 * Fill / clear the whole selection (context menu "fill selection" / "clear selection content").
 * fill: cover with the foreground color; clear: destination-out to transparency.
 */
export function paintSelection(
  layer: RasterLayer,
  selection: Selection,
  mode: 'fill' | 'clear',
  color: string,
  lockAlpha = false,
): boolean {
  const asset = getCanvas(layer.assetId);
  const scale = assetScale(layer);
  if (!asset || !scale) return false;
  const ctx = asset.getContext('2d');
  if (!ctx) return false;

  ctx.save();
  ctx.scale(scale.sx, scale.sy);
  ctx.translate(-layer.x, -layer.y);
  clipToSelection(ctx, selection);
  ctx.globalCompositeOperation =
    mode === 'clear' ? 'destination-out' : lockAlpha ? 'source-atop' : 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
  ctx.restore();
  return true;
}

/**
 * Selection mask: paint everything outside the selection transparent (multiple outlines use nonzero).
 * When the selection has a feather radius, the mask alpha gets one gaussian blur for a soft edge.
 */
export function maskToSelection(
  canvas: HTMLCanvasElement,
  selection: Selection,
  region: Rect,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.translate(-region.x, -region.y);
  traceSelection(ctx, selection);
  ctx.fill('nonzero');
  ctx.restore();
  if (selection.feather > 0) featherCanvas(canvas, selection.feather);
}

/** Gaussian-feather a canvas's alpha (draw through a temp canvas so source !== destination) */
export function featherCanvas(canvas: HTMLCanvasElement, radius: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const temp = createCanvasElement(canvas.width, canvas.height);
  const tempCtx = temp.getContext('2d');
  if (!tempCtx) return;
  tempCtx.drawImage(canvas, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = `blur(${Math.max(0.1, Math.min(200, radius))}px)`;
  ctx.drawImage(temp, 0, 0);
  ctx.filter = 'none';
}

/**
 * Paint bucket: fill same-colored areas within the tolerance.
 * `contiguous = true` runs a scanline flood fill (connected region only); `false` recolors the whole image.
 */
export function floodFill(
  layer: RasterLayer,
  docX: number,
  docY: number,
  color: string,
  tolerance: number,
  selection: Selection | null,
  lockAlpha = false,
  contiguous = true,
): boolean {
  const asset = getCanvas(layer.assetId);
  if (!asset) return false;
  const ctx = asset.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  const scale = assetScale(layer);
  if (!scale) return false;
  const px = Math.floor((docX - layer.x) * scale.sx);
  const py = Math.floor((docY - layer.y) * scale.sy);
  if (px < 0 || py < 0 || px >= asset.width || py >= asset.height) return false;

  const frame = ctx.getImageData(0, 0, asset.width, asset.height);
  const data = frame.data;
  const start = (py * asset.width + px) * 4;
  const target = [data[start], data[start + 1], data[start + 2], data[start + 3]];
  const fill = hexToRgba(color);
  if (
    Math.abs(target[0] - fill[0]) <= tolerance &&
    Math.abs(target[1] - fill[1]) <= tolerance &&
    Math.abs(target[2] - fill[2]) <= tolerance &&
    Math.abs(target[3] - fill[3]) <= tolerance &&
    fill[3] === target[3]
  ) {
    return false;
  }

  const tol = tolerance;

  if (!contiguous) {
    // Global replace: per-pixel test, no connectivity check
    for (let y = 0; y < asset.height; y += 1) {
      for (let x = 0; x < asset.width; x += 1) {
        if (!matches(data, x, y, asset.width, target, tol)) continue;
        if (selection && !insideSelectionDoc(selection, layer, scale, x, y)) continue;
        const offset = (y * asset.width + x) * 4;
        if (lockAlpha && data[offset + 3] === 0) continue;
        data[offset] = fill[0];
        data[offset + 1] = fill[1];
        data[offset + 2] = fill[2];
        data[offset + 3] = fill[3];
      }
    }
    ctx.putImageData(frame, 0, 0);
    return true;
  }

  const visited = new Uint8Array(asset.width * asset.height);
  const stack: number[] = [px, py];
  while (stack.length > 0) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;
    if (y < 0 || y >= asset.height) continue;
    let left = x;
    while (
      left >= 0 &&
      matches(data, left, y, asset.width, target, tol) &&
      !visited[y * asset.width + left]
    ) {
      left -= 1;
    }
    left += 1;
    let right = x;
    while (
      right < asset.width &&
      matches(data, right, y, asset.width, target, tol) &&
      !visited[y * asset.width + right]
    ) {
      right += 1;
    }
    right -= 1;
    for (let i = left; i <= right; i += 1) {
      const index = y * asset.width + i;
      if (visited[index]) continue;
      visited[index] = 1;
      if (selection && !insideSelectionDoc(selection, layer, scale, i, y)) continue;
      const offset = index * 4;
      // Lock transparent pixels: never add content where the pixel is fully transparent
      if (lockAlpha && data[offset + 3] === 0) continue;
      data[offset] = fill[0];
      data[offset + 1] = fill[1];
      data[offset + 2] = fill[2];
      data[offset + 3] = fill[3];
    }
    for (let i = left; i <= right; i += 1) {
      if (
        y > 0 &&
        !visited[(y - 1) * asset.width + i] &&
        matches(data, i, y - 1, asset.width, target, tol)
      ) {
        stack.push(i, y - 1);
      }
      if (
        y + 1 < asset.height &&
        !visited[(y + 1) * asset.width + i] &&
        matches(data, i, y + 1, asset.width, target, tol)
      ) {
        stack.push(i, y + 1);
      }
    }
  }
  ctx.putImageData(frame, 0, 0);
  return true;
}

function matches(
  data: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  target: number[],
  tolerance: number,
): boolean {
  const offset = (y * width + x) * 4;
  return (
    Math.abs(data[offset] - target[0]) <= tolerance &&
    Math.abs(data[offset + 1] - target[1]) <= tolerance &&
    Math.abs(data[offset + 2] - target[2]) <= tolerance &&
    Math.abs(data[offset + 3] - target[3]) <= tolerance
  );
}

function insideSelectionDoc(
  selection: Selection,
  layer: RasterLayer,
  scale: { sx: number; sy: number },
  assetX: number,
  assetY: number,
): boolean {
  // Reuse core's hit test: it already handles rect / oval / lasso and the "holes" invert produces
  return pointInSelection(selection, layer.x + assetX / scale.sx, layer.y + assetY / scale.sy);
}

function hexToRgba(hex: string): [number, number, number, number] {
  const value = hex.trim().replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [0, 0, 0, 255];
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
    255,
  ];
}
