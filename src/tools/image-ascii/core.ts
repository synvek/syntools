import type { ToolResult } from '@/core/types';

export const ASCII_CHARSETS: { id: string; chars: string }[] = [
  { id: 'standard', chars: ' .:-=+*#%@' },
  { id: 'blocks', chars: ' ░▒▓█' },
  { id: 'minimal', chars: ' .*#' },
  { id: 'long', chars: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$' },
];

export const DEFAULT_ASCII_WIDTH = 80;

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export interface AsciiOptions {
  cols: number;
  charset: string;
  invert: boolean;
  /** 字符宽高比补偿，默认 0.5（等宽字体下字符高约为宽 2 倍） */
  aspect?: number;
}

/** 将 RGBA 像素数据转换为 ASCII 艺术。 */
export function imageDataToAscii(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  options: AsciiOptions,
): ToolResult<string> {
  if (width < 1 || height < 1) return { ok: false, error: 'EMPTY' };
  if (pixels.length < width * height * 4) return { ok: false, error: 'INVALID' };

  const cols = Math.max(1, Math.min(Math.round(options.cols), 400));
  const charset = options.charset && options.charset.length > 1 ? options.charset : ' .:-=+*#%@';
  const aspect = options.aspect ?? 0.5;
  const rows = Math.max(1, Math.round((height / width) * cols * aspect));

  const blockW = width / cols;
  const blockH = height / rows;
  const stepX = Math.max(1, Math.floor(blockW / 2));
  const stepY = Math.max(1, Math.floor(blockH / 2));
  const lines: string[] = [];

  for (let ry = 0; ry < rows; ry += 1) {
    let line = '';
    for (let rx = 0; rx < cols; rx += 1) {
      let sum = 0;
      let count = 0;
      const x0 = Math.floor(rx * blockW);
      const y0 = Math.floor(ry * blockH);
      for (let y = y0; y < y0 + blockH && y < height; y += stepY) {
        for (let x = x0; x < x0 + blockW && x < width; x += stepX) {
          const i = (y * width + x) * 4;
          sum += luminance(pixels[i], pixels[i + 1], pixels[i + 2]);
          count += 1;
        }
      }
      const lum = count > 0 ? sum / count : 0;
      const normalized = options.invert ? lum / 255 : 1 - lum / 255;
      const idx = Math.min(
        charset.length - 1,
        Math.max(0, Math.round(normalized * (charset.length - 1))),
      );
      line += charset[idx];
    }
    lines.push(line);
  }
  return { ok: true, value: lines.join('\n') };
}
