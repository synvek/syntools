import type { ToolResult } from '@/core/types';

/**
 * 颜色转换（Tasks T39）：HEX / RGB / HSL 互转，纯函数无依赖。
 * 错误码与文案解耦：core 返回语言无关错误码，UI 层经 i18n 翻译（T29 约定）。
 */

export type ColorErrorCode = 'EMPTY' | 'INVALID';

export interface RgbColor {
  r: number; // 0-255
  g: number;
  b: number;
}

export interface HslColor {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export const COLOR_FORMATS = ['hex', 'rgb', 'hsl'] as const;
export type ColorFormat = (typeof COLOR_FORMATS)[number];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const toIntChannel = (raw: string): number | null => {
  const text = raw.trim();
  if (text.endsWith('%')) {
    const pct = Number(text.slice(0, -1));
    if (!Number.isFinite(pct)) return null;
    return Math.round(clamp(pct, 0, 100) * 2.55);
  }
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  return Math.round(clamp(n, 0, 255));
};

const toPercent = (raw: string): number | null => {
  const text = raw.trim();
  const n = Number(text.endsWith('%') ? text.slice(0, -1) : text);
  if (!Number.isFinite(n)) return null;
  return clamp(n, 0, 100);
};

function parseHex(input: string): RgbColor | null {
  const hex = input.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  // #RGB / #RRGGBB；带 alpha 的 #RGBA / #RRGGBBAA 解析 RGB 部分、忽略 alpha
  if (hex.length === 3 || hex.length === 4) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  if (hex.length === 6 || hex.length === 8) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return null;
}

function parseFunctional(input: string): RgbColor | null {
  const match = /^(rgba?|hsla?)\s*\(([^)]*)\)$/i.exec(input);
  if (!match) return null;
  const fn = match[1].toLowerCase();
  // 同时支持逗号与空格分隔（CSS Color 4），alpha 分量忽略
  const parts = match[2]
    .split(/[\s,/]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p !== '/');
  if (parts.length < 3 || parts.length > 4) return null;

  if (fn.startsWith('rgb')) {
    const [r, g, b] = parts.map(toIntChannel);
    if (r === null || g === null || b === null) return null;
    return { r, g, b };
  }
  const h = Number(parts[0]);
  const s = toPercent(parts[1]);
  const l = toPercent(parts[2]);
  if (!Number.isFinite(h) || s === null || l === null) return null;
  return hslToRgb({ h: ((h % 360) + 360) % 360, s, l });
}

/** 解析颜色输入：#RGB / #RRGGBB（含 alpha 变体）/ rgb() / rgba() / hsl() / hsla() */
export function parseColor(input: string): ToolResult<RgbColor> {
  const text = input.trim();
  if (!text) return { ok: false, error: 'EMPTY' };
  const color = text.startsWith('#') ? parseHex(text) : parseFunctional(text);
  if (!color) return { ok: false, error: 'INVALID' };
  return { ok: true, value: color };
}

/** RGB → HEX（小写 #rrggbb） */
export function rgbToHex({ r, g, b }: RgbColor): string {
  const hex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** RGB → HSL（h 0-360，s/l 0-100，四舍五入到整数） */
export function rgbToHsl({ r, g, b }: RgbColor): HslColor {
  const rn = clamp(r, 0, 255) / 255;
  const gn = clamp(g, 0, 255) / 255;
  const bn = clamp(b, 0, 255) / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** HSL → RGB（标准算法，结果四舍五入到 0-255） */
export function hslToRgb({ h, s, l }: HslColor): RgbColor {
  const hn = (((h % 360) + 360) % 360) / 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const channel = (t: number) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  return {
    r: Math.round(channel(hn + 1 / 3) * 255),
    g: Math.round(channel(hn) * 255),
    b: Math.round(channel(hn - 1 / 3) * 255),
  };
}

/** RGB → 指定格式的字符串 */
export function formatColor(color: RgbColor, format: ColorFormat): string {
  const { r, g, b } = color;
  if (format === 'hex') return rgbToHex(color);
  if (format === 'rgb') return `rgb(${r}, ${g}, ${b})`;
  const { h, s, l } = rgbToHsl(color);
  return `hsl(${h}, ${s}%, ${l}%)`;
}
