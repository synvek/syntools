import { decompressFrames, parseGIF } from 'gifuct-js';
import type { ToolResult } from '@/core/types';

/**
 * GIF 拆帧：解析帧数据（合成在 UI canvas）。
 */

export type GifError = 'NOT_GIF' | 'EMPTY' | 'PARSE';

export interface GifFrameData {
  dims: { top: number; left: number; width: number; height: number };
  delay: number;
  disposalType: number;
  patch: Uint8ClampedArray;
}

export interface GifParsed {
  width: number;
  height: number;
  frames: GifFrameData[];
}

export function isGifFile(type: string, name?: string): boolean {
  if (type === 'image/gif') return true;
  return Boolean(name?.toLowerCase().endsWith('.gif'));
}

export function parseGifBuffer(buffer: ArrayBuffer): ToolResult<GifParsed> {
  if (!buffer || buffer.byteLength === 0) return { ok: false, error: 'EMPTY' };
  try {
    const gif = parseGIF(buffer);
    const frames = decompressFrames(gif, true) as GifFrameData[];
    if (!frames.length) return { ok: false, error: 'PARSE' };
    const width = Number(gif.lsd?.width) || frames[0].dims.width;
    const height = Number(gif.lsd?.height) || frames[0].dims.height;
    if (!width || !height) return { ok: false, error: 'PARSE' };
    return {
      ok: true,
      value: {
        width,
        height,
        frames: frames.map((f) => ({
          dims: f.dims,
          delay: Math.max(20, Number(f.delay) || 100),
          disposalType: Number(f.disposalType) || 0,
          patch: f.patch,
        })),
      },
    };
  } catch {
    return { ok: false, error: 'PARSE' };
  }
}
