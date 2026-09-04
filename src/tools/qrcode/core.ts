import { toDataURL } from 'qrcode';
import jsQR from 'jsqr';
import type { ToolResult } from '@/core/types';

/**
 * 二维码生成与解析（Tasks T37）：基于 qrcode + jsqr，纯前端无数据外发。
 * 错误码与文案解耦：core 返回语言无关错误码，UI 层经 i18n 翻译（T29 约定）。
 */

export type QrErrorCode = 'EMPTY' | 'TOO_LONG' | 'NOT_FOUND' | 'DECODE' | 'INVALID_COLOR' | 'INVALID_MARGIN';

/** 纠错等级：L≈7% / M≈15% / Q≈25% / H≈30% */
export const QR_LEVELS = ['L', 'M', 'Q', 'H'] as const;
export type QrLevel = (typeof QR_LEVELS)[number];

/** 输出边长（px） */
export const QR_SIZES = [128, 256, 512, 1024] as const;
export type QrSize = (typeof QR_SIZES)[number];

export const MIN_MARGIN = 0;
export const MAX_MARGIN = 10;
export const DEFAULT_FG = '#000000';
export const DEFAULT_BG = '#ffffff';

export interface QrOptions {
  level: QrLevel;
  size: QrSize;
  /** 前景色（深色模块） */
  foreground: string;
  /** 背景色（浅色模块 / quiet zone） */
  background: string;
  /** 边距（模块数，quiet zone） */
  margin: number;
}

export const DEFAULT_QR_OPTIONS: QrOptions = {
  level: 'M',
  size: 256,
  foreground: DEFAULT_FG,
  background: DEFAULT_BG,
  margin: 2,
};

/** 归一化为 #RRGGBB；非法返回 null */
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

/** 校验并归一化生成选项 */
export function resolveQrOptions(
  partial: Partial<QrOptions> = {},
): ToolResult<QrOptions> {
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

/** 生成二维码（PNG dataURL）；内容超出容量时返回 TOO_LONG */
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

/** 从 RGBA 像素数据解码二维码；未识别时返回 NOT_FOUND */
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
