import { REPAIR_SPACING, healOffset, mixChannel } from '../core';
import { createCanvasElement, getCanvas } from '../model/assets';
import type { Selection } from '../model/types';
import { createStampSession, type StampHost, type StampSession } from './stamp';

/**
 * Healing tool family: clone stamp / healing brush / spot healing / smudge / blur / sharpen.
 *
 * All build on the stamp session in `render/stamp.ts`; this module only defines what one stamp does:
 * - **stamp**: copy from the snapshot taken at stroke start at a fixed offset (the source follows the tip);
 * - **healing**: copy source texture, shifted by "source mean → target mean" to match color while keeping it;
 * - **spot healing**: no sampling, just fill with the mean of the tip's outer ring (simplified, see below);
 * - **smudge**: drag the previous stamp's result along as a buffer, smearing it;
 * - **blur / sharpen**: box-blur the stamp locally, then blend by weight (sharpen uses unsharp masking).
 */

export type RepairMode = 'clone' | 'heal' | 'spot' | 'smudge' | 'blur' | 'sharpen';

export interface RepairOptions {
  mode: RepairMode;
  /** Tip diameter in document units */
  size: number;
  /** Strength 0~100 (opacity) */
  strength: number;
  selection: Selection | null;
  /** Sample point for stamp / healing (document coordinates) */
  source?: { x: number; y: number } | null;
}

export type RepairSession = StampSession;

/** One stroke = one snapshot: sampling while painting would clone the pattern onto itself (smearing) */
function snapshotOf(host: StampHost): HTMLCanvasElement | null {
  const asset = getCanvas(host.assetId);
  if (!asset) return null;
  const copy = createCanvasElement(asset.width, asset.height);
  const ctx = copy.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(asset, 0, 0);
  return copy;
}

export function createCloneSession(host: StampHost, options: RepairOptions): RepairSession | null {
  const asset = getCanvas(host.assetId);
  const ctx = asset?.getContext('2d', { willReadFrequently: true }) ?? null;
  const snapshot = snapshotOf(host);
  const snapshotCtx = snapshot?.getContext('2d', { willReadFrequently: true }) ?? null;
  if (!asset || !ctx || !snapshot || !snapshotCtx) return null;
  const sx = asset.width / Math.max(1, host.width);
  const sy = asset.height / Math.max(1, host.height);
  const amount = Math.max(0, Math.min(100, options.strength)) / 100;
  const mode = options.mode;
  const source = options.source ?? null;

  /** Fixed offset of the source from the tip, set at the first stamp (like Photoshop with "aligned" off) */
  let offset: { x: number; y: number } | null = null;

  return createStampSession(host, {
    size: options.size,
    spacing: REPAIR_SPACING,
    selection: options.selection,
    onStamp: (frame, context) => {
      const cx = (context.x - host.x) * sx;
      const cy = (context.y - host.y) * sy;
      if (context.first && mode !== 'spot') {
        if (!source) return false;
        offset = { x: (source.x - context.x) * sx, y: (source.y - context.y) * sy };
      }

      const count = frame.width * frame.height;

      // Spot healing: fill with the mean of the outer ring (1.0~1.5× radius); no sample point needed
      if (mode === 'spot') {
        const ring = ringMean(asset, ctx, cx, cy, options.size / 2, sx, sy);
        if (!ring) return false;
        let touched = false;
        for (let index = 0; index < count; index += 1) {
          const weight = frame.weightAt(index);
          if (weight <= 0) continue;
          const offsetByte = index * 4;
          if (frame.data[offsetByte + 3] === 0) continue;
          const blend = weight * amount * context.pressure;
          for (let channel = 0; channel < 3; channel += 1) {
            frame.data[offsetByte + channel] = mixChannel(
              frame.data[offsetByte + channel],
              ring[channel],
              blend,
            );
          }
          touched = true;
        }
        return touched;
      }

      const shift = offset;
      if (!shift) return false;
      // Read the source block at stamp size in one go: per-pixel getImageData would be unusably slow
      const sourceFrame = snapshotCtx.getImageData(
        Math.round(frame.left + shift.x),
        Math.round(frame.top + shift.y),
        frame.width,
        frame.height,
      );
      const weights = new Float32Array(count);
      for (let index = 0; index < count; index += 1) weights[index] = frame.weightAt(index);

      // Healing: shift the source mean onto the target mean, keeping texture while matching color
      let colorShift: [number, number, number] = [0, 0, 0];
      if (mode === 'heal') {
        const sourceMean = weightedMean(sourceFrame.data, weights);
        const targetMean = weightedMean(frame.data, weights);
        if (sourceMean && targetMean) colorShift = healOffset(sourceMean, targetMean);
      }

      let touched = false;
      for (let index = 0; index < count; index += 1) {
        const weight = weights[index];
        if (weight <= 0) continue;
        const offsetByte = index * 4;
        if (sourceFrame.data[offsetByte + 3] === 0) continue;
        if (frame.data[offsetByte + 3] === 0 && mode === 'clone') continue;
        const blend = weight * amount * context.pressure;
        for (let channel = 0; channel < 3; channel += 1) {
          frame.data[offsetByte + channel] = mixChannel(
            frame.data[offsetByte + channel],
            sourceFrame.data[offsetByte + channel] + colorShift[channel],
            blend,
          );
        }
        frame.data[offsetByte + 3] = Math.max(
          frame.data[offsetByte + 3],
          Math.round(sourceFrame.data[offsetByte + 3] * blend),
        );
        touched = true;
      }
      return touched;
    },
  });
}

/** Weighted mean inside the stamp (weight > 0 and opaque) */
function weightedMean(
  data: Uint8ClampedArray,
  weights: Float32Array,
): [number, number, number] | null {
  const acc = [0, 0, 0];
  let sum = 0;
  for (let index = 0; index < weights.length; index += 1) {
    const weight = weights[index];
    if (weight <= 0) continue;
    const offset = index * 4;
    if (data[offset + 3] === 0) continue;
    acc[0] += data[offset] * weight;
    acc[1] += data[offset + 1] * weight;
    acc[2] += data[offset + 2] * weight;
    sum += weight;
  }
  if (sum <= 0) return null;
  return [acc[0] / sum, acc[1] / sum, acc[2] / sum];
}

/** Mean of the tip's outer ring (the sample source for spot healing) */
function ringMean(
  asset: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radiusDoc: number,
  sx: number,
  sy: number,
): [number, number, number] | null {
  const rx = radiusDoc * sx;
  const ry = radiusDoc * sy;
  const left = Math.max(0, Math.floor(cx - rx * 1.6));
  const top = Math.max(0, Math.floor(cy - ry * 1.6));
  const right = Math.min(asset.width, Math.ceil(cx + rx * 1.6));
  const bottom = Math.min(asset.height, Math.ceil(cy + ry * 1.6));
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;
  const data = ctx.getImageData(left, top, width, height).data;
  const acc = [0, 0, 0];
  let sum = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const distance = Math.hypot((left + x + 0.5 - cx) / rx, (top + y + 0.5 - cy) / ry);
      if (distance < 1 || distance > 1.5) continue;
      const offset = (y * width + x) * 4;
      if (data[offset + 3] < 8) continue;
      acc[0] += data[offset];
      acc[1] += data[offset + 1];
      acc[2] += data[offset + 2];
      sum += 1;
    }
  }
  if (sum === 0) return null;
  return [acc[0] / sum, acc[1] / sum, acc[2] / sum];
}

/**
 * Smudge: treat the previous stamp's result as a buffer and drag it here by strength.
 *
 * The buffer re-samples as the tip moves, so consecutive stamps naturally smear —
 * which is what smudging is, rather than a plain gaussian blur.
 */
export function createSmudgeSession(host: StampHost, options: RepairOptions): RepairSession | null {
  const amount = Math.max(0, Math.min(100, options.strength)) / 100;
  let buffer: { width: number; height: number; data: Uint8ClampedArray } | null = null;
  return createStampSession(host, {
    size: options.size,
    spacing: REPAIR_SPACING,
    selection: options.selection,
    onStamp: (frame, context) => {
      const count = frame.width * frame.height;
      const current = new Uint8ClampedArray(frame.data);
      if (!buffer || buffer.width !== frame.width || buffer.height !== frame.height) {
        // First stamp, or the bbox changed size (hitting an edge): just initialize the buffer, draw nothing
        buffer = { width: frame.width, height: frame.height, data: current };
        return false;
      }
      const previous = buffer;
      const blend = amount * context.pressure;
      let touched = false;
      for (let index = 0; index < count; index += 1) {
        const weight = frame.weightAt(index);
        if (weight <= 0) continue;
        const offset = index * 4;
        const mix = weight * blend;
        frame.data[offset] = mixChannel(frame.data[offset], previous.data[offset], mix);
        frame.data[offset + 1] = mixChannel(frame.data[offset + 1], previous.data[offset + 1], mix);
        frame.data[offset + 2] = mixChannel(frame.data[offset + 2], previous.data[offset + 2], mix);
        frame.data[offset + 3] = mixChannel(frame.data[offset + 3], previous.data[offset + 3], mix);
        touched = true;
      }
      buffer = {
        width: frame.width,
        height: frame.height,
        data: new Uint8ClampedArray(frame.data),
      };
      return touched;
    },
  });
}

/** Blur / sharpen tip: local box blur, then blend by weight (sharpen inverts it as unsharp masking) */
export function createFocusSession(host: StampHost, options: RepairOptions): RepairSession | null {
  const amount = Math.max(0, Math.min(100, options.strength)) / 100;
  const sharpen = options.mode === 'sharpen';
  return createStampSession(host, {
    size: options.size,
    spacing: REPAIR_SPACING,
    selection: options.selection,
    onStamp: (frame, context) => {
      const blurred = boxBlurRgba(frame.data, frame.width, frame.height, 1);
      const count = frame.width * frame.height;
      let touched = false;
      for (let index = 0; index < count; index += 1) {
        const weight = frame.weightAt(index);
        if (weight <= 0) continue;
        const offset = index * 4;
        if (frame.data[offset + 3] === 0) continue;
        const blend = weight * amount * context.pressure;
        for (let channel = 0; channel < 3; channel += 1) {
          const value = frame.data[offset + channel];
          const target = sharpen
            ? Math.max(0, Math.min(255, value + (value - blurred[offset + channel]) * blend * 2))
            : blurred[offset + channel];
          frame.data[offset + channel] = sharpen ? target : mixChannel(value, target, blend);
        }
        touched = true;
      }
      return touched;
    },
  });
}

/**
 * Box blur (separable: horizontal then vertical, two passes at O(w·h·r)).
 *
 * Exported for tests: jsdom has no 2D context, so pixel math can only be covered through pure functions.
 */
export function boxBlurRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  const r = Math.max(1, Math.round(radius));
  const out = new Uint8ClampedArray(data.length);
  const temp = new Float32Array(data.length);
  const windowSize = r * 2 + 1;
  // Horizontal
  for (let y = 0; y < height; y += 1) {
    for (let channel = 0; channel < 4; channel += 1) {
      let acc = 0;
      for (let x = -r; x <= r; x += 1) {
        acc += data[(y * width + Math.min(width - 1, Math.max(0, x))) * 4 + channel];
      }
      for (let x = 0; x < width; x += 1) {
        temp[(y * width + x) * 4 + channel] = acc / windowSize;
        const addX = Math.min(width - 1, x + r + 1);
        const subX = Math.max(0, x - r);
        acc += data[(y * width + addX) * 4 + channel] - data[(y * width + subX) * 4 + channel];
      }
    }
  }
  // Vertical
  for (let x = 0; x < width; x += 1) {
    for (let channel = 0; channel < 4; channel += 1) {
      let acc = 0;
      for (let y = -r; y <= r; y += 1) {
        acc += temp[(Math.min(height - 1, Math.max(0, y)) * width + x) * 4 + channel];
      }
      for (let y = 0; y < height; y += 1) {
        out[(y * width + x) * 4 + channel] = acc / windowSize;
        const addY = Math.min(height - 1, y + r + 1);
        const subY = Math.max(0, y - r);
        acc += temp[(addY * width + x) * 4 + channel] - temp[(subY * width + x) * 4 + channel];
      }
    }
  }
  return out;
}
