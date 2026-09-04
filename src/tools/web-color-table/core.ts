import { WEB_COLORS, type WebColor, type WebColorGroup } from './colors';

export type { WebColor, WebColorGroup };
export { WEB_COLORS, WEB_COLOR_GROUPS } from './colors';

export interface WebColorRow extends WebColor {
  rgb: string;
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function toWebColorRows(colors: WebColor[] = WEB_COLORS): WebColorRow[] {
  return colors.map((c) => {
    const rgb = hexToRgb(c.hex) ?? { r: 0, g: 0, b: 0 };
    return {
      ...c,
      ...rgb,
      rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    };
  });
}

export function filterWebColors(
  rows: WebColorRow[],
  query: string,
  group: WebColorGroup | 'all' = 'all',
): WebColorRow[] {
  const q = query.trim().toLowerCase().replace(/^#/, '');
  return rows.filter((row) => {
    if (group !== 'all' && row.group !== group) return false;
    if (!q) return true;
    if (row.name.toLowerCase().includes(q)) return true;
    if (row.hex.toLowerCase().replace(/^#/, '').includes(q)) return true;
    if (row.rgb.toLowerCase().includes(q)) return true;
    if (`${row.r},${row.g},${row.b}`.includes(q)) return true;
    return false;
  });
}

/** 浅色背景用深色字，深色背景用浅色字 */
export function contrastText(hex: string): '#111827' | '#f9fafb' {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#111827';
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= 160 ? '#111827' : '#f9fafb';
}
