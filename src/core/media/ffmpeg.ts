import type { FFmpeg } from '@ffmpeg/ffmpeg';
import type { ToolResult } from '@/core/types';
import { isFfmpegSupported } from './support';

/** 自托管核心版本，需与 `scripts/fetch-ffmpeg-core.mjs` 保持一致。 */
export const FFMPEG_CORE_VERSION = '0.12.10';

/** 解析自托管核心文件的 URL（尊重 Vite base，兼容子路径部署）。 */
export function ffmpegCoreUrl(file: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}ffmpeg/${FFMPEG_CORE_VERSION}/${file}`;
}

let instance: FFmpeg | null = null;
let pending: Promise<FFmpeg> | null = null;

const logListeners = new Set<(line: string) => void>();
/** 当前运行期的进度回调（ffmpeg.wasm 的 progress 事件是全局单例，故用可变引用转发）。 */
let progressHandler: ((ratio: number) => void) | null = null;

/** 订阅 ffmpeg 日志，返回取消订阅函数。 */
export function onFfmpegLog(listener: (line: string) => void): () => void {
  logListeners.add(listener);
  return () => logListeners.delete(listener);
}

/**
 * 懒加载 ffmpeg.wasm（core-mt，多线程）。
 * 单例复用：多次调用只会加载一次核心。
 */
export async function loadFfmpeg(): Promise<ToolResult<FFmpeg>> {
  if (!isFfmpegSupported()) {
    return { ok: false, error: globalThis.SharedArrayBuffer ? 'NEED_ISOLATION' : 'UNSUPPORTED' };
  }
  if (instance) return { ok: true, value: instance };

  if (!pending) {
    pending = (async () => {
      const { FFmpeg: FFmpegClass } = await import('@ffmpeg/ffmpeg');
      const ff = new FFmpegClass();
      ff.on('log', ({ message }) => {
        for (const listener of logListeners) listener(message);
      });
      ff.on('progress', ({ progress }) => {
        // ffmpeg.wasm 在时长未知时会给出 NaN，这里做一次过滤
        if (Number.isFinite(progress)) progressHandler?.(Math.min(1, Math.max(0, progress)));
      });
      await ff.load({
        coreURL: ffmpegCoreUrl('ffmpeg-core.js'),
        wasmURL: ffmpegCoreUrl('ffmpeg-core.wasm'),
        workerURL: ffmpegCoreUrl('ffmpeg-core.worker.js'),
      });
      instance = ff;
      return ff;
    })();
  }

  try {
    return { ok: true, value: await pending };
  } catch {
    pending = null;
    return { ok: false, error: 'LOAD_FAILED' };
  }
}

export interface FfmpegRunOptions {
  /** 完整 ffmpeg 参数（不含程序名），输入/输出文件名需与 inputs/output 对应。 */
  args: string[];
  inputs: { name: string; data: Uint8Array }[];
  /** 输出文件名（ffmpeg 输出到虚拟 FS 的这个文件）。 */
  output: string;
  onProgress?: (ratio: number) => void;
}

/** 在 ffmpeg 虚拟 FS 中执行一次任务并读回输出文件。 */
export async function runFfmpeg(options: FfmpegRunOptions): Promise<ToolResult<Uint8Array>> {
  const loaded = await loadFfmpeg();
  if (!loaded.ok) return loaded;
  const ff = loaded.value;

  progressHandler = options.onProgress ?? null;
  const tempInputs: string[] = [];
  try {
    for (const input of options.inputs) {
      await ff.writeFile(input.name, input.data);
      tempInputs.push(input.name);
    }
    await ff.exec(options.args);
    const data = await ff.readFile(options.output);
    if (data == null) return { ok: false, error: 'OUTPUT_MISSING' };
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
    return { ok: true, value: bytes };
  } catch {
    return { ok: false, error: 'EXEC_FAILED' };
  } finally {
    progressHandler = null;
    for (const name of tempInputs) {
      await ff.deleteFile(name).catch(() => undefined);
    }
    await ff.deleteFile(options.output).catch(() => undefined);
  }
}
