import { mixChannel, pointInSelection, type RetouchMode } from '../core';
import type { Selection } from '../model/types';
import { createStampSession, type StampFrame, type StampSession } from './stamp';
import type { StampHost } from './stamp';

/**
 * Retouch tool family: dodge / burn / sponge.
 *
 * Stamp stepping, coordinate mapping and pressure normalization all come from the generic session in
 * `render/stamp.ts`; this module only decides how each pixel inside one stamp changes.
 * One stroke = one history entry; the caller must call `commitPixels` before painting to save the original pixels.
 */

export interface RetouchOptions {
  mode: RetouchMode;
  /** Brush tip diameter in document coordinates */
  size: number;
  /** 0~100: maximum modulation per stamp (%) */
  strength: number;
  selection: Selection | null;
}

export type RetouchSession = StampSession;

/** Stamp spacing (relative to the diameter): too dense and the repeated accumulation blows out instantly */
const SPACING = 0.25;
/** Base amount per stamp: maps a 0~100 strength to something visible each stamp without overshooting */
const STAMP_GAIN = 0.06;

export function createRetouchSession(
  layer: StampHost,
  options: RetouchOptions,
): RetouchSession | null {
  const amount = Math.max(0, Math.min(100, options.strength)) / 100;
  return createStampSession(layer, {
    size: options.size,
    spacing: SPACING,
    selection: options.selection,
    onStamp: (frame, context) => {
      const gain = amount * context.pressure * STAMP_GAIN;
      let touched = false;
      const count = frame.width * frame.height;
      for (let index = 0; index < count; index += 1) {
        const falloff = frame.weightAt(index);
        if (falloff <= 0) continue;
        const offset = index * 4;
        if (frame.data[offset + 3] === 0) continue;
        modulate(frame, offset, options.mode, gain * falloff);
        touched = true;
      }
      return touched;
    },
  });
}

/** Per-pixel modulation: dodge brightens / burn darkens / sponge desaturates */
function modulate(frame: StampFrame, offset: number, mode: RetouchMode, weight: number): void {
  const data = frame.data;
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  if (mode === 'sponge') {
    const gray = r * 0.299 + g * 0.587 + b * 0.114;
    data[offset] = mixChannel(r, gray, weight);
    data[offset + 1] = mixChannel(g, gray, weight);
    data[offset + 2] = mixChannel(b, gray, weight);
    return;
  }
  // Dodge moves toward white, burn toward black. Computed per channel so the color relationship is preserved
  const target = mode === 'dodge' ? 255 : 0;
  data[offset] = mixChannel(r, target, weight);
  data[offset + 1] = mixChannel(g, target, weight);
  data[offset + 2] = mixChannel(b, target, weight);
}

/** Reused by the repair tools: whether this pixel lies inside the selection (same source as the stamp weight) */
export { pointInSelection };
