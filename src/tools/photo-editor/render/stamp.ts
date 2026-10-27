import { MAX_STAMPS_PER_MOVE, pointInSelection, stampFalloff, walkStamps } from '../core';
import { getCanvas } from '../model/assets';
import type { Selection } from '../model/types';

/**
 * Stamp session: the shared skeleton of the retouch family (dodge / burn / sponge / stamp / heal / smudge / blur).
 *
 * It handles three error-prone things: document → canvas pixels, even stepping along a stroke, pressure scaling.
 * What each stamp does is left to the caller's `onStamp`, so tools only care about their own pixel math.
 *
 * Performance: each stamp only `getImageData`s its own bounding box (a dirty rect), never the whole layer.
 */

export interface StampHost {
  assetId: string;
  /** Top-left and size in document coordinates (their ratio to the canvas pixels is the scale) */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StampFrame {
  /** Stamp bounding box in canvas pixel coordinates */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Pixel data of the bounding box (modified in place, then written back by `put`) */
  data: Uint8ClampedArray;
  /** Tip weight for that pixel (0 outside the circle / selection); `index` is a pixel index, not bytes */
  weightAt: (index: number) => number;
  /** Canvas pixel coordinates */
  pixelAt: (index: number) => { x: number; y: number };
  /** Write the bounding box back (call only when something actually changed) */
  put: () => void;
}

export interface StampContext {
  /** Document coordinates */
  x: number;
  y: number;
  /** Pressure normalized to 0~1 */
  pressure: number;
  /** Whether this is the stroke's first stamp (it fixes the source offset for cloning tools) */
  first: boolean;
}

export interface StampSessionOptions {
  /** Tip diameter in document units */
  size: number;
  /** Spacing (relative to the diameter) */
  spacing: number;
  selection: Selection | null;
  /** Each stamp returns true when it changed pixels */
  onStamp: (frame: StampFrame, context: StampContext) => boolean;
}

export interface StampSession {
  /** `pressure` defaults to 1 */
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
        // A click (no drag) must still leave one stamp
        stamp(x, y, value);
        last = { x, y };
        travelled = step;
        return;
      }
      const result = walkStamps(last.x, last.y, x, y, step, travelled);
      for (const position of result.positions) stamp(position.x, position.y, value);
      // When an extreme jump is truncated, snap to the current point so later stamps don't follow the old path
      travelled = result.positions.length >= MAX_STAMPS_PER_MOVE ? step : result.next;
      last = { x, y };
    },
    end: () => {
      last = null;
      first = true;
    },
  };
}
