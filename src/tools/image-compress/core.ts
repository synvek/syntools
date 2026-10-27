/**
 * Image compression / format conversion (Tasks T42): core holds only pure functions free of browser APIs
 * (the canvas / toBlob encode pipeline lives in the UI), which keeps it testable under jsdom.
 * Error codes are decoupled from copy: core returns language-neutral codes that the UI translates via i18n (T29 convention).
 */

export type ImageErrorCode = 'NOT_IMAGE' | 'ENCODE';

export interface ImageFormatEntry {
  /** MIME type, passed straight to canvas.toBlob */
  id: string;
  /** Output file extension */
  ext: string;
  /** Fixed display name (a technical term, never translated) */
  label: string;
  /** Whether a lossy quality parameter applies */
  lossy: boolean;
}

export const IMAGE_FORMATS: readonly ImageFormatEntry[] = [
  { id: 'image/png', ext: 'png', label: 'PNG', lossy: false },
  { id: 'image/jpeg', ext: 'jpg', label: 'JPEG', lossy: true },
  { id: 'image/webp', ext: 'webp', label: 'WebP', lossy: true },
];

/** Longest-edge limit options (px); 0 keeps the original size */
export const MAX_DIMENSIONS = [0, 2048, 1024, 512] as const;
export type MaxDimension = (typeof MAX_DIMENSIONS)[number];

export const MIN_QUALITY = 0.1;
export const MAX_QUALITY = 1;

export function formatById(id: string): ImageFormatEntry | null {
  return IMAGE_FORMATS.find((f) => f.id === id) ?? null;
}

/** Clamp quality to [0.1, 1]; invalid values fall back to 0.8 */
export function clampQuality(q: number): number {
  if (!Number.isFinite(q)) return 0.8;
  return Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, q));
}

/** Whether the MIME type is an accepted image type */
export function isImageFile(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith('image/');
}

/** Proportional target size: never exceeds maxDim and never upscales; maxDim=0 returns the original size */
export function computeTargetSize(
  width: number,
  height: number,
  maxDim: MaxDimension,
): { width: number; height: number } {
  if (!maxDim || (width <= maxDim && height <= maxDim)) {
    return { width, height };
  }
  const scale = maxDim / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Output file name: drop the old extension and append the new one; falls back to "image" when unnamed */
export function buildOutputFilename(originalName: string, formatId: string): string {
  const format = formatById(formatId);
  const ext = format?.ext ?? 'png';
  const base = originalName.replace(/\.[^.]+$/, '').trim() || 'image';
  return `${base}.${ext}`;
}

/** Size change in percent: positive means bytes saved; null when before ≤ 0 */
export function compressionRatio(before: number, after: number): number | null {
  if (before <= 0) return null;
  return Math.round(((before - after) / before) * 100);
}

/** Human-readable byte count */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
