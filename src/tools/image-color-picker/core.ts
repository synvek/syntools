import type { ToolResult } from '@/core/types';

/**
 * 图片取色：从 ImageData 按坐标取样，返回 HEX/RGB。
 */

export type ImageColorError = 'OUT_OF_BOUNDS';

export interface PickedColor {
  hex: string;
  rgb: string;
  r: number;
  g: number;
  b: number;
  a: number;
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, '0');
}

export function samplePixel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): ToolResult<PickedColor> {
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= width || py >= height) {
    return { ok: false, error: 'OUT_OF_BOUNDS' };
  }
  const i = (py * width + px) * 4;
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const a = data[i + 3];
  return {
    ok: true,
    value: {
      r,
      g,
      b,
      a,
      hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
      rgb: a < 255 ? `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})` : `rgb(${r}, ${g}, ${b})`,
    },
  };
}

export function isImageFile(type: string): boolean {
  return type.startsWith('image/');
}
