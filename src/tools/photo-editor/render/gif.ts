/**
 * GIF encoding (GIF89a, single frame).
 *
 * Browsers **cannot** encode GIF from a canvas (`toBlob` only does png / jpeg / webp), so this is hand-rolled:
 * palette quantization (5-bit buckets + frequency sort) + nearest-color mapping + GIF-flavored LZW.
 *
 * Unlike the editor's other exports, GIF is capped at 256 colors and consumed one-way (web animations,
 * chat apps), so **stability and size** win and there is no dithering: dithering adds visible noise
 * without a real gain — export PNG / WebP when you need smooth gradients.
 */

import type { PixelSource } from './tiff';

/** Quantization bits per channel: 5-bit → 32768 buckets, enough for gradients without blowing up the palette */
const QUANTIZE_BITS = 5;
/** At most 256 palette entries; when transparency is needed, one index is reserved for it */
const MAX_PALETTE = 256;
/** Alpha below this counts as transparent (GIF is fully on / fully off only) */
const ALPHA_THRESHOLD = 128;

export interface GifOptions {
  /** Whether to keep transparency (GIF has binary alpha only) */
  alpha?: boolean;
}

interface Quantized {
  /** Palette (RGB triplets), padded to a power of two */
  palette: Uint8Array;
  /** Number of colors actually used (before padding) */
  colorCount: number;
  /** Palette index per pixel */
  indices: Uint8Array;
  /** Transparent color index; -1 means transparency is not needed */
  transparentIndex: number;
}

/**
 * RGBA → palette + indices.
 *
 * Two steps: bucket by `QUANTIZE_BITS` to find the **most used colors** (averaging inside a bucket so
 * gradients don't collapse to one tone), then map each pixel to the nearest entry. A cache table absorbs
 * repeated colors, cutting nearest-color search from O(pixels × palette) to O(distinct colors × palette).
 */
function quantize(image: PixelSource, alpha: boolean): Quantized {
  const { data } = image;
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let needsTransparent = false;
  for (let i = 0; i < data.length; i += 4) {
    if (alpha && data[i + 3] < ALPHA_THRESHOLD) {
      needsTransparent = true;
      continue;
    }
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key =
      ((r >> (8 - QUANTIZE_BITS)) << 10) |
      ((g >> (8 - QUANTIZE_BITS)) << 5) |
      (b >> (8 - QUANTIZE_BITS));
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.n += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { n: 1, r, g, b });
    }
  }

  const limit = needsTransparent ? MAX_PALETTE - 1 : MAX_PALETTE;
  const ranked = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((bucket) => [bucket.r / bucket.n, bucket.g / bucket.n, bucket.b / bucket.n] as const);

  // Extreme case (a fully transparent image): add black so the palette is never empty
  if (ranked.length === 0) ranked.push([0, 0, 0]);

  const transparentIndex = needsTransparent ? ranked.length : -1;
  const colorCount = needsTransparent ? ranked.length + 1 : ranked.length;
  const size = paletteSize(colorCount);
  const palette = new Uint8Array(size * 3);
  ranked.forEach((color, index) => {
    palette[index * 3] = Math.round(color[0]);
    palette[index * 3 + 1] = Math.round(color[1]);
    palette[index * 3 + 2] = Math.round(color[2]);
  });

  const indices = new Uint8Array(data.length / 4);
  const cache = new Map<number, number>();
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    if (alpha && data[i + 3] < ALPHA_THRESHOLD) {
      indices[p] = transparentIndex;
      continue;
    }
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = (r << 16) | (g << 8) | b;
    const cached = cache.get(key);
    if (cached !== undefined) {
      indices[p] = cached;
      continue;
    }
    let best = 0;
    let bestDistance = Infinity;
    for (let index = 0; index < ranked.length; index += 1) {
      const dr = ranked[index][0] - r;
      const dg = ranked[index][1] - g;
      const db = ranked[index][2] - b;
      const distance = dr * dr + dg * dg + db * db;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
    cache.set(key, best);
    indices[p] = best;
  }

  return { palette, colorCount: ranked.length, indices, transparentIndex };
}

/** Palette size must be a power of two (2~256) */
function paletteSize(count: number): number {
  let size = 2;
  while (size < count) size *= 2;
  return Math.min(MAX_PALETTE, size);
}

/**
 * GIF-flavored LZW.
 *
 * Unlike TIFF's deflate, GIF uses variable-width LZW: the code width starts at `minCodeSize + 1`,
 * grows by one bit each time the dictionary doubles, up to 12 bits, after which a Clear code must
 * reopen the dictionary (otherwise new strings don't fit and the ratio collapses).
 */
function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  const out: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;
  const emit = (code: number, bits: number) => {
    bitBuffer |= code << bitCount;
    bitCount += bits;
    while (bitCount >= 8) {
      out.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  let codeSize = minCodeSize + 1;
  let next = eoiCode + 1;
  const dict = new Map<number, number>();
  const reset = () => {
    dict.clear();
    next = eoiCode + 1;
    codeSize = minCodeSize + 1;
  };

  emit(clearCode, codeSize);
  if (indices.length === 0) {
    emit(eoiCode, codeSize);
  } else {
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i += 1) {
      const pixel = indices[i];
      // Key = prefix code * 256 + pixel: prefix ≤ 4095 and pixel ≤ 255, so a 20-bit integer holds it
      const key = prefix * 256 + pixel;
      const found = dict.get(key);
      if (found !== undefined) {
        prefix = found;
        continue;
      }
      emit(prefix, codeSize);
      if (next === 1 << codeSize) {
        if (codeSize < 12) {
          codeSize += 1;
        } else {
          emit(clearCode, codeSize);
          reset();
          prefix = pixel;
          continue;
        }
      }
      dict.set(key, next);
      next += 1;
      prefix = pixel;
    }
    emit(prefix, codeSize);
    emit(eoiCode, codeSize);
  }
  if (bitCount > 0) out.push(bitBuffer & 0xff);

  // Data is chained into sub-blocks of ≤255 bytes, terminated by a zero-length block
  const blocks = new Uint8Array(out.length + Math.ceil(out.length / 255) + 1);
  let write = 0;
  let read = 0;
  while (read < out.length) {
    const size = Math.min(255, out.length - read);
    blocks[write] = size;
    write += 1;
    blocks.set(Uint8Array.from(out.slice(read, read + size)), write);
    write += size;
    read += size;
  }
  blocks[write] = 0;
  return blocks.subarray(0, write + 1);
}

/** RGBA pixels → GIF89a bytes */
export function encodeGif(image: PixelSource, options: GifOptions = {}): Uint8Array {
  const { width, height } = image;
  const quantized = quantize(image, options.alpha ?? true);
  const size = paletteSize(quantized.colorCount + (quantized.transparentIndex >= 0 ? 1 : 0));
  const tableBits = Math.log2(size);
  const minCodeSize = Math.max(2, tableBits);

  const lzw = lzwEncode(quantized.indices, minCodeSize);
  const hasGce = quantized.transparentIndex >= 0;
  // 6(header) + 7(screen descriptor) + palette + optional GCE(8) + image descriptor(10) + minCode + LZW + trailer
  const total = 13 + size * 3 + (hasGce ? 8 : 0) + 10 + 1 + lzw.length + 1;
  const out = new Uint8Array(total);
  let cursor = 0;
  const push = (...bytes: number[]) => {
    out.set(bytes, cursor);
    cursor += bytes.length;
  };
  const push16 = (value: number) => push(value & 0xff, (value >> 8) & 0xff);

  // Header + logical screen descriptor
  out.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0); // "GIF89a"
  cursor = 6;
  push16(width);
  push16(height);
  // Global color table flag = 1, color resolution = tableBits - 1, sort flag = 0
  push(0x80 | ((tableBits - 1) & 0x07), 0, 0);
  out.set(quantized.palette.subarray(0, size * 3), cursor);
  cursor += size * 3;

  if (hasGce) {
    push(0x21, 0xf9, 4, 0x01);
    push16(0);
    push(quantized.transparentIndex, 0);
  }

  // Image descriptor
  push(0x2c);
  push16(0);
  push16(0);
  push16(width);
  push16(height);
  push(0);
  push(minCodeSize);
  out.set(lzw, cursor);
  cursor += lzw.length;
  push(0x3b); // Trailer

  return out.subarray(0, cursor);
}
