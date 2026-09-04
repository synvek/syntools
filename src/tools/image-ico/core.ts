import type { ToolResult } from '@/core/types';

/**
 * 图片 ↔ ICO：编码/解析纯逻辑（位图缩放在 UI canvas）。
 * 使用 PNG-in-ICO（Vista+），兼容现代浏览器与操作系统。
 */

export type IcoError = 'EMPTY' | 'INVALID_ICO' | 'NO_SIZES' | 'NOT_IMAGE';

/** 常用 favicon / 应用图标尺寸 */
export const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256] as const;
export type IcoSize = (typeof ICO_SIZES)[number];

export const DEFAULT_ICO_SIZES: IcoSize[] = [16, 32, 48];

export interface IcoPngFrame {
  width: number;
  height: number;
  png: Uint8Array;
}

export interface ParsedIcoEntry {
  width: number;
  height: number;
  /** PNG 或可预览的 data URL（BMP 条目解码为 PNG data URL 由 UI 处理时再转） */
  offset: number;
  size: number;
  /** 原始图像字节（PNG 或 BMP） */
  bytes: Uint8Array;
  format: 'png' | 'bmp' | 'unknown';
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function isBmpInfoHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 40) return false;
  const headerSize = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
  return headerSize === 40 || headerSize === 108 || headerSize === 124;
}

export function normalizeIcoSizes(sizes: number[]): ToolResult<IcoSize[]> {
  const allowed = new Set<number>(ICO_SIZES);
  const unique = [...new Set(sizes.filter((n) => allowed.has(n)))] as IcoSize[];
  unique.sort((a, b) => a - b);
  if (unique.length === 0) return { ok: false, error: 'NO_SIZES' };
  return { ok: true, value: unique };
}

export function isLikelyImageFile(type: string, name = ''): boolean {
  if (type.startsWith('image/')) return true;
  const lower = name.toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg|ico)$/i.test(lower);
}

export function isIcoFile(type: string, name = ''): boolean {
  if (type === 'image/x-icon' || type === 'image/vnd.microsoft.icon') return true;
  return name.toLowerCase().endsWith('.ico');
}

/** 将若干 PNG 帧打包为 ICO（PNG-in-ICO） */
export function encodeIco(frames: IcoPngFrame[]): ToolResult<Uint8Array> {
  if (frames.length === 0) return { ok: false, error: 'NO_SIZES' };
  for (const f of frames) {
    if (!f.png.length || !isPng(f.png)) return { ok: false, error: 'NOT_IMAGE' };
    if (f.width < 1 || f.height < 1 || f.width > 256 || f.height > 256) {
      return { ok: false, error: 'NO_SIZES' };
    }
  }

  const count = frames.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const offsets: number[] = [];
  let total = headerSize;
  for (const f of frames) {
    offsets.push(offset);
    offset += f.png.length;
    total += f.png.length;
  }

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type = ICO
  view.setUint16(4, count, true);

  for (let i = 0; i < count; i++) {
    const f = frames[i];
    const entry = 6 + i * 16;
    out[entry] = f.width >= 256 ? 0 : f.width;
    out[entry + 1] = f.height >= 256 ? 0 : f.height;
    out[entry + 2] = 0; // color count
    out[entry + 3] = 0; // reserved
    view.setUint16(entry + 4, 1, true); // planes
    view.setUint16(entry + 6, 32, true); // bit count
    view.setUint32(entry + 8, f.png.length, true);
    view.setUint32(entry + 12, offsets[i], true);
    out.set(f.png, offsets[i]);
  }

  return { ok: true, value: out };
}

/** 解析 ICO，提取各尺寸图像字节 */
export function parseIco(buffer: ArrayBuffer): ToolResult<ParsedIcoEntry[]> {
  if (!buffer || buffer.byteLength < 6) return { ok: false, error: 'EMPTY' };
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const reserved = view.getUint16(0, true);
  const type = view.getUint16(2, true);
  const count = view.getUint16(4, true);

  if (reserved !== 0 || (type !== 1 && type !== 2) || count < 1 || count > 64) {
    return { ok: false, error: 'INVALID_ICO' };
  }
  if (buffer.byteLength < 6 + count * 16) return { ok: false, error: 'INVALID_ICO' };

  const entries: ParsedIcoEntry[] = [];
  for (let i = 0; i < count; i++) {
    const entry = 6 + i * 16;
    const wByte = bytes[entry];
    const hByte = bytes[entry + 1];
    const size = view.getUint32(entry + 8, true);
    const offset = view.getUint32(entry + 12, true);
    if (size < 1 || offset < 0 || offset + size > buffer.byteLength) {
      return { ok: false, error: 'INVALID_ICO' };
    }
    const slice = bytes.slice(offset, offset + size);
    let width = wByte === 0 ? 256 : wByte;
    let height = hByte === 0 ? 256 : hByte;
    let format: ParsedIcoEntry['format'] = 'unknown';
    if (isPng(slice)) {
      format = 'png';
    } else if (isBmpInfoHeader(slice)) {
      format = 'bmp';
      // BMP in ICO stores height as 2× (XOR + AND mask)
      const bmpH = Math.abs(view.getInt32(offset + 8, true));
      const bmpW = Math.abs(view.getInt32(offset + 4, true));
      if (bmpW > 0) width = bmpW;
      if (bmpH > 0) height = Math.floor(bmpH / 2) || bmpH;
    }
    entries.push({ width, height, offset, size, bytes: slice, format });
  }

  entries.sort((a, b) => a.width - b.width || a.height - b.height);
  return { ok: true, value: entries };
}

export function icoToBlob(data: Uint8Array): Blob {
  return new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)], {
    type: 'image/x-icon',
  });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
