import type { ToolResult } from '@/core/types';

export type ExifErrorCode = 'EMPTY' | 'UNSUPPORTED' | 'PROCESS_FAILED';

export interface ExifInfo {
  orientation: number | null;
  make: string | null;
  hasExif: boolean;
}

export interface StripResult {
  bytes: Uint8Array;
  info: ExifInfo;
  filename: string;
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readAscii(bytes: Uint8Array, offset: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i += 1) {
    const c = bytes[offset + i];
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

/** Best-effort EXIF orientation / Make from APP1 */
export function readBasicExif(bytes: Uint8Array): ExifInfo {
  let orientation: number | null = null;
  let make: string | null = null;
  let hasExif = false;
  let i = 2;
  while (i + 4 < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    if (marker === 0xda || marker === 0xd9) break; // SOS / EOI
    const size = readUint16BE(bytes, i + 2);
    if (size < 2 || i + 2 + size > bytes.length) break;
    if (marker === 0xe1) {
      const start = i + 4;
      const header = readAscii(bytes, start, 6);
      if (header.startsWith('Exif')) {
        hasExif = true;
        // Very light scan for Orientation (0x0112) and Make ASCII in TIFF IFD is complex;
        // scan for common ASCII Make strings after Exif header as best-effort.
        const payload = bytes.subarray(start, i + 2 + size);
        const text = new TextDecoder('latin1').decode(payload);
        const makeMatch = text.match(/Make\0([^\0]{1,64})\0/);
        if (makeMatch) make = makeMatch[1];
        // Orientation tag short value often appears as 01 12 00 03 ... value
        for (let j = 0; j < payload.length - 12; j += 1) {
          if (payload[j] === 0x01 && payload[j + 1] === 0x12 && payload[j + 2] === 0x00 && payload[j + 3] === 0x03) {
            orientation = payload[j + 8] || payload[j + 9] || null;
            break;
          }
          if (payload[j] === 0x12 && payload[j + 1] === 0x01 && payload[j + 2] === 0x03 && payload[j + 3] === 0x00) {
            orientation = payload[j + 8] || payload[j + 9] || null;
            break;
          }
        }
      }
    }
    i += 2 + size;
  }
  return { orientation, make, hasExif };
}

/** Strip APP1 (EXIF) segments from JPEG */
export function stripJpegExif(
  bytes: Uint8Array,
  sourceName = 'image.jpg',
): ToolResult<StripResult> {
  if (!bytes.length) return { ok: false, error: 'EMPTY' };
  if (!isJpeg(bytes)) return { ok: false, error: 'UNSUPPORTED' };

  try {
    const info = readBasicExif(bytes);
    const out: number[] = [0xff, 0xd8];
    let i = 2;
    while (i + 4 <= bytes.length) {
      if (bytes[i] !== 0xff) {
        // copy remaining from here (entropy-coded data path)
        for (let k = i; k < bytes.length; k += 1) out.push(bytes[k]);
        break;
      }
      const marker = bytes[i + 1];
      if (marker === 0xd8) {
        i += 2;
        continue;
      }
      if (marker === 0xd9) {
        out.push(0xff, 0xd9);
        break;
      }
      if (marker === 0xda) {
        // SOS: copy rest
        for (let k = i; k < bytes.length; k += 1) out.push(bytes[k]);
        break;
      }
      // standalone markers without length
      if (marker >= 0xd0 && marker <= 0xd7) {
        out.push(0xff, marker);
        i += 2;
        continue;
      }
      const size = readUint16BE(bytes, i + 2);
      if (size < 2 || i + 2 + size > bytes.length) {
        return { ok: false, error: 'PROCESS_FAILED' };
      }
      if (marker !== 0xe1) {
        for (let k = i; k < i + 2 + size; k += 1) out.push(bytes[k]);
      }
      i += 2 + size;
    }

    const result = new Uint8Array(out);
    const base = sourceName.replace(/\.[^.]+$/, '') || 'image';
    return {
      ok: true,
      value: {
        bytes: result,
        info,
        filename: `${base}-no-exif.jpg`,
      },
    };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}
