import { ALL_FORMATS, BlobSource, CanvasSink, Input, type InputFormat } from 'mediabunny';
import type { ToolResult } from '@/core/types';
import { hasWebCodecsVideo } from './support';

export interface ExtractedFrame {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface ExtractFramesOptions {
  /** 起始时间（秒） */
  start?: number;
  /** 截取时长（秒） */
  duration?: number;
  fps: number;
  /** 输出宽度（像素），高度按比例 */
  width?: number;
  maxFrames?: number;
  onProgress?: (ratio: number) => void;
}

/**
 * 使用 WebCodecs + Mediabunny 按时间点精确抽帧。
 * 相比 `<video>` + seek 的方式，帧更准、速度更快；不支持时返回错误码，由调用方回退。
 */
export async function extractFramesWebCodecs(
  file: Blob,
  options: ExtractFramesOptions,
): Promise<ToolResult<ExtractedFrame[]>> {
  if (!hasWebCodecsVideo()) return { ok: false, error: 'WEBCodecs_VIDEO_MISSING' };

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS as InputFormat[] });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return { ok: false, error: 'NO_VIDEO_TRACK' };
    if (!(await track.canDecode())) return { ok: false, error: 'UNDECODABLE' };

    const total = await input.computeDuration();
    if (!Number.isFinite(total) || total <= 0) return { ok: false, error: 'UNKNOWN_DURATION' };

    const start = Math.max(0, Math.min(options.start ?? 0, Math.max(0, total - 0.05)));
    const duration = Math.min(options.duration ?? 3, Math.max(0.1, total - start));
    const fps = Math.min(30, Math.max(1, options.fps));
    const count = Math.max(1, Math.min(Math.round(duration * fps), options.maxFrames ?? 200));
    const timestamps = Array.from({ length: count }, (_, i) =>
      Math.min(start + i / fps, Math.max(0, total - 0.001)),
    );

    const sink = new CanvasSink(track, { width: options.width, poolSize: 2 });
    const frames: ExtractedFrame[] = [];
    let index = 0;
    for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
      if (wrapped) {
        const canvas = wrapped.canvas;
        const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D | null;
        if (ctx) {
          const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          frames.push({ rgba: data, width, height });
        }
      }
      index += 1;
      options.onProgress?.(index / count);
    }

    if (frames.length === 0) return { ok: false, error: 'NO_FRAMES' };
    return { ok: true, value: frames };
  } catch {
    return { ok: false, error: 'DECODE_FAILED' };
  } finally {
    (input as { dispose?: () => void }).dispose?.();
  }
}
