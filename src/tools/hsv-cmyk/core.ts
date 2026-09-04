import type { ToolResult } from '@/core/types';

/**
 * HSV / CMYK / RGB / HEX 互转（纯函数）。
 */

export type ColorSpaceError = 'EMPTY' | 'INVALID';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsv {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
}

export interface Cmyk {
  c: number; // 0-100
  m: number; // 0-100
  y: number; // 0-100
  k: number; // 0-100
}

export interface ColorState {
  hex: string;
  rgb: Rgb;
  hsv: Hsv;
  cmyk: Cmyk;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function clampRgb(r: number, g: number, b: number): Rgb {
  return {
    r: Math.round(clamp(r, 0, 255)),
    g: Math.round(clamp(g, 0, 255)),
    b: Math.round(clamp(b, 0, 255)),
  };
}

export function clampHsv(h: number, s: number, v: number): Hsv {
  return {
    h: Math.round((((h % 360) + 360) % 360) * 10) / 10,
    s: Math.round(clamp(s, 0, 100) * 10) / 10,
    v: Math.round(clamp(v, 0, 100) * 10) / 10,
  };
}

export function clampCmyk(c: number, m: number, y: number, k: number): Cmyk {
  return {
    c: Math.round(clamp(c, 0, 100) * 10) / 10,
    m: Math.round(clamp(m, 0, 100) * 10) / 10,
    y: Math.round(clamp(y, 0, 100) * 10) / 10,
    k: Math.round(clamp(k, 0, 100) * 10) / 10,
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const hex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function hexToRgb(input: string): ToolResult<Rgb> {
  const text = input.trim();
  if (!text) return { ok: false, error: 'EMPTY' };
  const raw = text.startsWith('#') ? text.slice(1) : text;
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(raw)) {
    return { ok: false, error: 'INVALID' };
  }
  if (raw.length === 3) {
    return {
      ok: true,
      value: {
        r: parseInt(raw[0] + raw[0], 16),
        g: parseInt(raw[1] + raw[1], 16),
        b: parseInt(raw[2] + raw[2], 16),
      },
    };
  }
  return {
    ok: true,
    value: {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    },
  };
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = clamp(r, 0, 255) / 255;
  const gn = clamp(g, 0, 255) / 255;
  const bn = clamp(b, 0, 255) / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  return clampHsv(h, s, v);
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const hh = (((h % 360) + 360) % 360) / 60;
  const ss = clamp(s, 0, 100) / 100;
  const vv = clamp(v, 0, 100) / 100;
  const c = vv * ss;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = vv - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hh < 1) [rp, gp, bp] = [c, x, 0];
  else if (hh < 2) [rp, gp, bp] = [x, c, 0];
  else if (hh < 3) [rp, gp, bp] = [0, c, x];
  else if (hh < 4) [rp, gp, bp] = [0, x, c];
  else if (hh < 5) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return clampRgb((rp + m) * 255, (gp + m) * 255, (bp + m) * 255);
}

export function rgbToCmyk({ r, g, b }: Rgb): Cmyk {
  const rn = clamp(r, 0, 255) / 255;
  const gn = clamp(g, 0, 255) / 255;
  const bn = clamp(b, 0, 255) / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k >= 1 - 1e-9) return { c: 0, m: 0, y: 0, k: 100 };
  const c = ((1 - rn - k) / (1 - k)) * 100;
  const m = ((1 - gn - k) / (1 - k)) * 100;
  const y = ((1 - bn - k) / (1 - k)) * 100;
  return clampCmyk(c, m, y, k * 100);
}

export function cmykToRgb({ c, m, y, k }: Cmyk): Rgb {
  const cn = clamp(c, 0, 100) / 100;
  const mn = clamp(m, 0, 100) / 100;
  const yn = clamp(y, 0, 100) / 100;
  const kn = clamp(k, 0, 100) / 100;
  return clampRgb(
    255 * (1 - cn) * (1 - kn),
    255 * (1 - mn) * (1 - kn),
    255 * (1 - yn) * (1 - kn),
  );
}

export function fromRgb(rgb: Rgb): ColorState {
  const normalized = clampRgb(rgb.r, rgb.g, rgb.b);
  return {
    hex: rgbToHex(normalized),
    rgb: normalized,
    hsv: rgbToHsv(normalized),
    cmyk: rgbToCmyk(normalized),
  };
}

export function fromHex(hex: string): ToolResult<ColorState> {
  const parsed = hexToRgb(hex);
  if (!parsed.ok) return parsed;
  return { ok: true, value: fromRgb(parsed.value) };
}

export function fromHsv(hsv: Hsv): ColorState {
  return fromRgb(hsvToRgb(clampHsv(hsv.h, hsv.s, hsv.v)));
}

export function fromCmyk(cmyk: Cmyk): ColorState {
  return fromRgb(cmykToRgb(clampCmyk(cmyk.c, cmyk.m, cmyk.y, cmyk.k)));
}
