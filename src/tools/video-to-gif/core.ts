import type { ToolResult } from '@/core/types';

const LEVELS = [0, 51, 102, 153, 204, 255];

/** 216 色 web-safe 调色板（256 项，尾部补零）。 */
export function buildWebPalette(): Uint8Array {
  const palette = new Uint8Array(768);
  let i = 0;
  for (const r of LEVELS) {
    for (const g of LEVELS) {
      for (const b of LEVELS) {
        palette[i] = r;
        palette[i + 1] = g;
        palette[i + 2] = b;
        i += 3;
      }
    }
  }
  return palette;
}

function level(v: number): number {
  return Math.min(5, Math.max(0, Math.round(v / 51)));
}

/** 将 RGBA 像素量化为调色板索引（index = r·36 + g·6 + b）。 */
export function quantizeFrame(rgba: Uint8ClampedArray, pixelCount: number): Uint8Array {
  const out = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i += 1) {
    out[i] = level(rgba[i * 4]) * 36 + level(rgba[i * 4 + 1]) * 6 + level(rgba[i * 4 + 2]);
  }
  return out;
}

/** GIF LZW 压缩（LSB-first 位打包，子块由调用方切分）。 */
export function lzwEncode(pixels: Uint8Array, minCodeSize: number): number[] {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  const dict = new Map<number, number>();
  const output: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;

  const writeCode = (code: number) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      output.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  writeCode(clearCode);
  if (pixels.length === 0) {
    writeCode(endCode);
    if (bitCount > 0) output.push(bitBuffer & 0xff);
    return output;
  }

  let prefix = pixels[0];
  for (let i = 1; i < pixels.length; i += 1) {
    const k = pixels[i];
    const key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    writeCode(prefix);
    dict.set(key, nextCode);
    nextCode += 1;
    if (nextCode > 4095) {
      writeCode(clearCode);
      dict.clear();
      nextCode = endCode + 1;
      codeSize = minCodeSize + 1;
    } else if (nextCode === 1 << codeSize && codeSize < 12) {
      codeSize += 1;
    }
    prefix = k;
  }
  writeCode(prefix);
  writeCode(endCode);
  if (bitCount > 0) output.push(bitBuffer & 0xff);
  return output;
}

export interface GifFrame {
  indices: Uint8Array;
  delayCentiseconds: number;
}

function ascii(str: string): number[] {
  return Array.from(str, (c) => c.charCodeAt(0));
}

/** 组装 GIF89a（全局调色板 + 循环）。 */
export function encodeGif(
  frames: GifFrame[],
  width: number,
  height: number,
  palette: Uint8Array = buildWebPalette(),
): Uint8Array {
  const out: number[] = [];
  const pushShort = (n: number) => {
    out.push(n & 0xff, (n >> 8) & 0xff);
  };

  out.push(...ascii('GIF89a'));
  pushShort(width);
  pushShort(height);
  out.push(0xf7); // GCT 存在 + 256 色
  out.push(0); // 背景色索引
  out.push(0); // 像素宽高比
  for (let i = 0; i < 768; i += 1) out.push(palette[i] ?? 0);

  // Netscape 循环扩展
  out.push(0x21, 0xff, 0x0b, ...ascii('NETSCAPE2.0'), 0x03, 0x01);
  pushShort(0);
  out.push(0x00);

  for (const frame of frames) {
    out.push(0x21, 0xf9, 0x04, 0x00);
    pushShort(frame.delayCentiseconds);
    out.push(0x00, 0x00);
    out.push(0x2c);
    pushShort(0);
    pushShort(0);
    pushShort(width);
    pushShort(height);
    out.push(0x00);
    out.push(8); // min code size
    const data = lzwEncode(frame.indices, 8);
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.slice(i, i + 255);
      out.push(chunk.length, ...chunk);
    }
    out.push(0x00);
  }
  out.push(0x3b);
  return new Uint8Array(out);
}

export interface VideoGifOptions {
  start: number;
  duration: number;
  fps: number;
  width: number;
}

/** 由若干 RGBA 帧生成 GIF。 */
export function framesToGif(
  frames: { rgba: Uint8ClampedArray; width: number; height: number }[],
  fps: number,
): ToolResult<Uint8Array> {
  if (frames.length === 0) return { ok: false, error: 'EMPTY' };
  if (!Number.isFinite(fps) || fps <= 0) return { ok: false, error: 'INVALID_FPS' };
  const { width, height } = frames[0];
  const delay = Math.max(2, Math.round(100 / fps));
  const gifFrames: GifFrame[] = frames.map((f) => ({
    indices: quantizeFrame(f.rgba, width * height),
    delayCentiseconds: delay,
  }));
  return { ok: true, value: encodeGif(gifFrames, width, height) };
}
