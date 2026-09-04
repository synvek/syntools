import type { ToolResult } from '@/core/types';

/**
 * 占位图参数校验（实际绘制在 UI canvas）。
 */

export type PlaceholderError = 'INVALID_SIZE' | 'INVALID_COLOR';

export interface PlaceholderOptions {
  width: number;
  height: number;
  bg: string;
  fg: string;
  text: string;
}

export const MIN_SIZE = 16;
export const MAX_SIZE = 4000;

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeHex(color: string): string | null {
  const c = color.trim();
  if (!HEX_RE.test(c)) return null;
  if (c.length === 4) {
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`.toLowerCase();
  }
  return c.toLowerCase();
}

export function validatePlaceholder(options: {
  width: number;
  height: number;
  bg: string;
  fg: string;
  text: string;
}): ToolResult<PlaceholderOptions> {
  const { width, height, bg, fg, text } = options;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < MIN_SIZE ||
    height < MIN_SIZE ||
    width > MAX_SIZE ||
    height > MAX_SIZE
  ) {
    return { ok: false, error: 'INVALID_SIZE' };
  }
  const bgN = normalizeHex(bg);
  const fgN = normalizeHex(fg);
  if (!bgN || !fgN) return { ok: false, error: 'INVALID_COLOR' };
  return {
    ok: true,
    value: {
      width,
      height,
      bg: bgN,
      fg: fgN,
      text: text.trim() || `${width}×${height}`,
    },
  };
}
