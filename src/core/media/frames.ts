import { ALL_FORMATS, BlobSource, CanvasSink, Input, type InputFormat } from 'mediabunny';
import type { ToolResult } from '@/core/types';
import { hasWebCodecsVideo } from './support';

export interface ExtractedFrame {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface ExtractFramesOptions {
  /** Start time (seconds) */
  start?: number;
  /** Capture duration (seconds) */
  duration?: number;
  fps: number;
  /** Output width (px); height follows the aspect ratio */
  width?: number;
  maxFrames?: number;
  onProgress?: (ratio: number) => void;
}

/**
 * Extract frames at exact timestamps with WebCodecs + Mediabunny.
 * More accurate and faster than `<video>` + seek; returns an error code for the caller to fall back on.
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
