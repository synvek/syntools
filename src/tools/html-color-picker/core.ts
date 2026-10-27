import type { ToolResult } from '@/core/types';
import { formatColor, parseColor, type RgbColor } from '@/tools/color-converter/core';

/**
 * HTML color picker: derive HEX/RGB/HSL plus common HTML/CSS snippets from a color value or the system picker.
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

/** Normalize a color to the 7-digit hex form that <input type="color"> requires */
export function toColorInputValue(hex: string): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  return m ? `#${m[1].toLowerCase()}` : '#000000';
}
