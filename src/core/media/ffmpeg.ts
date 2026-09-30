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

/** gzip 魔数（1f 8b）：用于确认下载到的确实是压缩副本，而不是 SPA fallback 返回的 HTML。 */
const GZIP_MAGIC = [0x1f, 0x8b];
/** wasm 魔数（00 61 73 6d，即 "\0asm"）：服务端已把 gzip 副本透明解码成原始 wasm 时出现。 */
const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d];

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((byte, index) => bytes[index] === byte);
}

/** `DecompressionStream` 在部分 TS lib 版本里缺失类型声明，这里给出一个最小签名。 */
type DecompressionStreamCtor = new (format: 'gzip') => TransformStream<Uint8Array, Uint8Array>;

/**
 * 解压 gzip 字节。
 * 优先用原生 DecompressionStream（流式、不阻塞主线程），缺失或失败时回退 pako（已随 gzip 工具打包）。
 */
async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const Native =
    (globalThis as unknown as { DecompressionStream?: DecompressionStreamCtor })
      .DecompressionStream ?? undefined;
  if (Native) {
    try {
      const stream = new Response(bytes).body?.pipeThrough(new Native('gzip'));
      if (stream) return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch {
      // 落到 pako
    }
  }
  const { ungzip } = await import('pako');
  return ungzip(bytes);
}

/**
 * 下载 gzip 版 wasm，必要时解压，并返回同源 blob: URL。
 *
 * 服务端行为有两种，都要兼容：
 * - 原样返回压缩副本（Pages 的常见行为）→ 前端解压；
 * - 带 Content-Encoding: gzip 返回（如 vite preview 把 .gz 当预压缩变体）→ fetch 已透明解码，
 *   直接拿到原始 wasm 字节，跳过解压。
 * 两种之外（404、SPA fallback 的 HTML）返回 null，由调用方回退到原始文件。
 */
async function loadCompressedWasm(): Promise<string | null> {
  let buffer: Uint8Array;
  try {
    const res = await fetch(ffmpegCoreUrl('ffmpeg-core.wasm.gz'));
    if (!res.ok) return null;
    buffer = new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }

  try {
    let wasm: Uint8Array | null = null;
    if (startsWith(buffer, GZIP_MAGIC)) wasm = await gunzip(buffer);
    else if (startsWith(buffer, WASM_MAGIC)) wasm = buffer;
    if (!wasm) return null;
    // blob: 与页面同源，不受 COEP / CSP 限制，core 及其 pthread worker 都能直接 fetch。
    // 不主动 revoke：多线程 core 会在每个 worker 里再次取这个 URL。
    return URL.createObjectURL(new Blob([wasm], { type: 'application/wasm' }));
  } catch {
    return null;
  }
}

let wasmUrl: Promise<string> | null = null;

/**
 * 解析 wasmURL：优先用 gzip 自托管副本（~9.8MB，Cloudflare Pages 单文件上限 25 MiB，
 * 原始 31.2MB 无法直接发布），运行时解压；副本缺失或解压失败时回退原始 ffmpeg-core.wasm。
 * 结果按会话缓存：只有真正用到 ffmpeg 兜底时才会下载并解压，平时零开销。
 */
export function resolveFfmpegWasmUrl(): Promise<string> {
  if (!wasmUrl) {
    wasmUrl = (async () => (await loadCompressedWasm()) ?? ffmpegCoreUrl('ffmpeg-core.wasm'))();
  }
  return wasmUrl;
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
        wasmURL: await resolveFfmpegWasmUrl(),
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
