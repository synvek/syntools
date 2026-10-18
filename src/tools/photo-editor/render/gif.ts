/**
 * GIF 编码（GIF89a，单帧）。
 *
 * 浏览器**不能**通过 canvas 编码 GIF（`toBlob` 只支持 png / jpeg / webp），所以这一份得自己写：
 * 调色板量化（5bit 分桶 + 频次排序）+ 最近色映射 + GIF 版 LZW。
 *
 * 与照片编辑器的其它导出不同，GIF 天生只有 256 色，且单向消费（网页动图 / 聊天工具），
 * 因此这里优先**稳定与体积**，不做抖动（dithering）：抖动会引入肉眼可见的噪点，
 * 却换不来真正的观感提升 —— 需要平滑渐变时应该导出 PNG / WebP。
 */

import type { PixelSource } from './tiff';

/** 每通道量化位数：5bit → 32768 个桶，足够覆盖常见渐变，又不至于把调色板撑爆 */
const QUANTIZE_BITS = 5;
/** 调色板最多 256 项；需要透明时留出 1 个索引给它 */
const MAX_PALETTE = 256;
/** alpha 低于此值视为透明（GIF 只有「全透 / 全不透」） */
const ALPHA_THRESHOLD = 128;

export interface GifOptions {
  /** 是否保留透明（GIF 只有二值透明） */
  alpha?: boolean;
}

interface Quantized {
  /** 调色板（RGB 三元组），长度已补齐到 2 的幂 */
  palette: Uint8Array;
  /** 实际使用的颜色数（补齐前） */
  colorCount: number;
  /** 每像素的调色板索引 */
  indices: Uint8Array;
  /** 透明色索引；-1 表示不需要透明 */
  transparentIndex: number;
}

/**
 * RGBA → 调色板 + 索引。
 *
 * 两步：先按 `QUANTIZE_BITS` 分桶统计出**用得最多的颜色**（取桶内均值，避免把渐变抖成单色），
 * 再把每个像素映射到最近的调色板色。映射用缓存表兜住重复颜色 —— 一张图里颜色种类远少于像素数，
 * 缓存能把「最近色搜索」从 O(像素数 × 调色板) 降到「O(颜色种类 × 调色板)」。
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

  // 极端情况（整张图全透明）：补一个黑色，保证调色板非空
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

/** 调色板容量必须是 2 的幂（2~256） */
function paletteSize(count: number): number {
  let size = 2;
  while (size < count) size *= 2;
  return Math.min(MAX_PALETTE, size);
}

/**
 * GIF 版 LZW。
 *
 * 与 TIFF 的 deflate 不同，GIF 用的是变长编码的 LZW：码长从 `minCodeSize + 1` 起，
 * 字典每满一倍就加一位，到 12 位为止；此后必须发一个 Clear 码重开字典
 * （否则字典塞不下新串，压缩率反而崩掉）。
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
      // 键 = 前缀码 * 256 + 像素：前缀码 ≤ 4095、像素 ≤ 255，一个 20 位整数装得下
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

  // 数据按 ≤255 字节的子块串接，最后以 0 长度块收尾
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

/** RGBA 像素 → GIF89a 字节 */
export function encodeGif(image: PixelSource, options: GifOptions = {}): Uint8Array {
  const { width, height } = image;
  const quantized = quantize(image, options.alpha ?? true);
  const size = paletteSize(quantized.colorCount + (quantized.transparentIndex >= 0 ? 1 : 0));
  const tableBits = Math.log2(size);
  const minCodeSize = Math.max(2, tableBits);

  const lzw = lzwEncode(quantized.indices, minCodeSize);
  const hasGce = quantized.transparentIndex >= 0;
  // 6(头) + 7(逻辑屏幕描述符) + 调色板 + 可选 GCE(8) + 图像描述符(10) + minCodeSize(1) + LZW + 结束符(1)
  const total = 13 + size * 3 + (hasGce ? 8 : 0) + 10 + 1 + lzw.length + 1;
  const out = new Uint8Array(total);
  let cursor = 0;
  const push = (...bytes: number[]) => {
    out.set(bytes, cursor);
    cursor += bytes.length;
  };
  const push16 = (value: number) => push(value & 0xff, (value >> 8) & 0xff);

  // 头 + 逻辑屏幕描述符
  out.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0); // "GIF89a"
  cursor = 6;
  push16(width);
  push16(height);
  // 全局调色板标志 = 1，颜色深度 = tableBits - 1，排序标志 = 0
  push(0x80 | ((tableBits - 1) & 0x07), 0, 0);
  out.set(quantized.palette.subarray(0, size * 3), cursor);
  cursor += size * 3;

  if (hasGce) {
    push(0x21, 0xf9, 4, 0x01);
    push16(0);
    push(quantized.transparentIndex, 0);
  }

  // 图像描述符
  push(0x2c);
  push16(0);
  push16(0);
  push16(width);
  push16(height);
  push(0);
  push(minCodeSize);
  out.set(lzw, cursor);
  cursor += lzw.length;
  push(0x3b); // 结束符

  return out.subarray(0, cursor);
}
