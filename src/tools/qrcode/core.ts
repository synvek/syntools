import { toDataURL } from 'qrcode';
import jsQR from 'jsqr';
import type { ToolResult } from '@/core/types';

/**
 * QR code generation and decoding (Tasks T37): built on qrcode + jsqr, fully client-side with no data sent out.
 * Error codes are decoupled from copy: core returns language-agnostic error codes and the UI translates them via i18n (T29 convention).
 */

export type QrErrorCode =
  'EMPTY' | 'TOO_LONG' | 'NOT_FOUND' | 'DECODE' | 'INVALID_COLOR' | 'INVALID_MARGIN';

/** Error correction level: L≈7% / M≈15% / Q≈25% / H≈30% */
export const QR_LEVELS = ['L', 'M', 'Q', 'H'] as const;
export type QrLevel = (typeof QR_LEVELS)[number];

/** Output side length (px) */
export const QR_SIZES = [128, 256, 512, 1024] as const;
export type QrSize = (typeof QR_SIZES)[number];

export const MIN_MARGIN = 0;
export const MAX_MARGIN = 10;
export const DEFAULT_FG = '#000000';
export const DEFAULT_BG = '#ffffff';

export interface QrOptions {
  level: QrLevel;
  size: QrSize;
  /** Foreground color (dark modules) */
  foreground: string;
  /** Background color (light modules / quiet zone) */
  background: string;
  /** Margin in modules (quiet zone) */
  margin: number;
}

export const DEFAULT_QR_OPTIONS: QrOptions = {
  level: 'M',
  size: 256,
  foreground: DEFAULT_FG,
  background: DEFAULT_BG,
  margin: 2,
};

/** Normalize to #RRGGBB; returns null when invalid */
export function normalizeQrColor(input: string): string | null {
  const raw = input.trim();
  const short = /^#([0-9a-fA-F]{3})$/.exec(raw);
  if (short) {
    const [r, g, b] = short[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const full = /^#([0-9a-fA-F]{6})$/.exec(raw);
  if (full) return `#${full[1]}`.toLowerCase();
  return null;
}

export function clampMargin(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  const m = Math.round(n);
  if (m < MIN_MARGIN || m > MAX_MARGIN) return null;
  return m;
}

/** Validate and normalize the generation options */
export function resolveQrOptions(partial: Partial<QrOptions> = {}): ToolResult<QrOptions> {
  const level = partial.level ?? DEFAULT_QR_OPTIONS.level;
  const size = partial.size ?? DEFAULT_QR_OPTIONS.size;
  if (!QR_LEVELS.includes(level) || !QR_SIZES.includes(size)) {
    return { ok: false, error: 'TOO_LONG' };
  }

  const fg = normalizeQrColor(partial.foreground ?? DEFAULT_FG);
  const bg = normalizeQrColor(partial.background ?? DEFAULT_BG);
  if (!fg || !bg) return { ok: false, error: 'INVALID_COLOR' };

  const margin = clampMargin(
    partial.margin === undefined ? DEFAULT_QR_OPTIONS.margin : partial.margin,
  );
  if (margin === null) return { ok: false, error: 'INVALID_MARGIN' };

  return {
    ok: true,
    value: { level, size, foreground: fg, background: bg, margin },
  };
}

/** Generate a QR code (PNG dataURL); returns TOO_LONG when the content exceeds capacity */
export async function generateQr(
  text: string,
  options: Partial<QrOptions> = {},
): Promise<ToolResult<string>> {
  if (!text.trim()) return { ok: false, error: 'EMPTY' };
  const resolved = resolveQrOptions(options);
  if (!resolved.ok) return resolved;
  const opts = resolved.value;
  try {
    const dataUrl = await toDataURL(text, {
      errorCorrectionLevel: opts.level,
      width: opts.size,
      margin: opts.margin,
      color: {
        dark: opts.foreground,
        light: opts.background,
      },
    });
    return { ok: true, value: dataUrl };
  } catch {
    return { ok: false, error: 'TOO_LONG' };
  }
}

/** Decode a QR code from RGBA pixel data; returns NOT_FOUND when unrecognized */
export function decodeQrFromImage(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): ToolResult<string> {
  try {
    const result = jsQR(data, width, height);
    if (!result || !result.data) return { ok: false, error: 'NOT_FOUND' };
    return { ok: true, value: result.data };
  } catch {
    return { ok: false, error: 'DECODE' };
  }
}
