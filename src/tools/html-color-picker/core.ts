import type { ToolResult } from '@/core/types';
import { formatColor, parseColor, type RgbColor } from '@/tools/color-converter/core';

/**
 * HTML 取色器：从色值 / 系统取色器得到 HEX/RGB/HSL 与常用 HTML/CSS 片段。
 */

export type ColorPickerError = 'EMPTY' | 'INVALID';

export interface ColorPickerResult {
  hex: string;
  rgb: string;
  hsl: string;
  cssColor: string;
  cssBg: string;
  htmlInline: string;
  rgbChannels: RgbColor;
}

export function buildColorPicker(input: string): ToolResult<ColorPickerResult> {
  const parsed = parseColor(input);
  if (!parsed.ok) return parsed;
  const color = parsed.value;
  const hex = formatColor(color, 'hex');
  const rgb = formatColor(color, 'rgb');
  const hsl = formatColor(color, 'hsl');
  return {
    ok: true,
    value: {
      hex,
      rgb,
      hsl,
      cssColor: `color: ${hex};`,
      cssBg: `background-color: ${hex};`,
      htmlInline: `style="color: ${hex}"`,
      rgbChannels: color,
    },
  };
}

/** 将 #rrggbb 规范为可被 <input type="color"> 使用的 7 位 hex */
export function toColorInputValue(hex: string): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  return m ? `#${m[1].toLowerCase()}` : '#000000';
}
