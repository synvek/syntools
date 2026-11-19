/**
 * Preset stamps (M3-4).
 *
 * A stamp is just a transparent PNG plus a fixed meaning, so it reuses the image pipeline on save.
 * The drawing itself needs a canvas; the *spec* (label, colour, size, font size) is pure and unit
 * tested, which is also what the gallery renders as a preview.
 */

import type { ImportedImage } from './imageImport';

export const STAMP_KEYS = ['approved', 'reviewed', 'void', 'draft'] as const;
export type StampKey = (typeof STAMP_KEYS)[number];

/** i18n key of each preset label */
export const STAMP_LABEL_KEYS: Record<StampKey, string> = {
  approved: 'stampApproved',
  reviewed: 'stampReviewed',
  void: 'stampVoid',
  draft: 'stampDraft',
};

export const STAMP_COLORS: Record<StampKey, string> = {
  approved: '#15803d',
  reviewed: '#1d4ed8',
  void: '#b3261e',
  draft: '#6b7280',
};

export interface StampSpec {
  width: number;
  height: number;
  fontSize: number;
  borderWidth: number;
  color: string;
  label: string;
}

/**
 * Visual spec of one stamp at 2× the size it will be inserted at.
 *
 * Fixed 3:1 aspect with the text size derived from the height keeps "已批准" and "Approved" looking
 * like the same rubber stamp instead of two different objects.
 */
export function stampSpec(key: StampKey, label: string): StampSpec {
  const width = 360;
  const height = 120;
  return {
    width,
    height,
    fontSize: Math.round(height * 0.42),
    borderWidth: 6,
    color: STAMP_COLORS[key],
    label,
  };
}

/** Draw a stamp into a canvas and return a transparent PNG data URL */
export async function renderStampDataUrl(spec: StampSpec): Promise<ImportedImage | null> {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = spec.width;
  canvas.height = spec.height;
  // jsdom throws "not implemented" instead of returning null; treat both as "no canvas"
  let context: CanvasRenderingContext2D | null = null;
  try {
    context = canvas.getContext('2d');
  } catch {
    return null;
  }
  if (!context) return null;

  const inset = spec.borderWidth;
  context.strokeStyle = spec.color;
  context.fillStyle = spec.color;
  context.lineWidth = spec.borderWidth;
  // Rounded double border reads as "rubber stamp" even at thumbnail size
  context.strokeRect(inset / 2, inset / 2, spec.width - inset, spec.height - inset);
  context.lineWidth = Math.max(2, spec.borderWidth / 3);
  context.strokeRect(inset * 2, inset * 2, spec.width - inset * 4, spec.height - inset * 4);

  context.font = `700 ${spec.fontSize}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(spec.label, spec.width / 2, spec.height / 2);

  try {
    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: spec.width,
      height: spec.height,
    };
  } catch {
    return null;
  }
}

/** Convenience: spec + rasterize in one call */
export async function createStampImage(
  key: StampKey,
  label: string,
): Promise<ImportedImage | null> {
  return renderStampDataUrl(stampSpec(key, label));
}
