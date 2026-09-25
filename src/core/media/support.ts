/**
 * 运行时媒体能力探测。
 *
 * 音视频处理采取「WebCodecs 优先 + ffmpeg.wasm fallback」策略：
 * - WebCodecs 由浏览器原生提供，零下载、可硬件加速，覆盖常见编解码；
 * - ffmpeg.wasm 作为兜底，覆盖 WebCodecs 不支持的容器/编码与滤镜，但需下载 ~31MB 核心。
 */

export type MediaEngine = 'webcodecs' | 'ffmpeg';

/** WebCodecs 视频编解码是否可用。 */
export function hasWebCodecsVideo(): boolean {
  return (
    typeof globalThis.VideoDecoder !== 'undefined' && typeof globalThis.VideoEncoder !== 'undefined'
  );
}

/** WebCodecs 音频编解码是否可用。 */
export function hasWebCodecsAudio(): boolean {
  return (
    typeof globalThis.AudioDecoder !== 'undefined' && typeof globalThis.AudioEncoder !== 'undefined'
  );
}

/** 页面是否处于 cross-origin isolated（SharedArrayBuffer 的前提）。 */
export function isCrossOriginIsolated(): boolean {
  return typeof globalThis.crossOriginIsolated === 'boolean' && globalThis.crossOriginIsolated;
}

/**
 * 多线程 ffmpeg.wasm（core-mt）是否可用。
 * 需要 Worker + WebAssembly + SharedArrayBuffer（即 COOP/COEP 生效）。
 */
export function isFfmpegSupported(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof WebAssembly !== 'undefined' &&
    typeof globalThis.SharedArrayBuffer !== 'undefined' &&
    isCrossOriginIsolated()
  );
}

/**
 * 媒体文件的默认大小上限。
 * 取 2GB —— 这是 WebAssembly 的硬上限（ffmpeg.wasm 亦受此限制），
 * 而通用 FileDropZone 默认的 10MB 会直接拒掉绝大多数真实音视频文件。
 */
export const MEDIA_MAX_BYTES = 2 * 1024 * 1024 * 1024;

/** 首选引擎：WebCodecs 可用即优先，否则退到 ffmpeg。 */
export function preferredEngine(): MediaEngine | null {
  if (hasWebCodecsVideo() || hasWebCodecsAudio()) return 'webcodecs';
  if (isFfmpegSupported()) return 'ffmpeg';
  return null;
}

/** 把探针结果整理成一句给用户看的提示（引擎 + 原因）。 */
export function describeEngineSupport(): {
  webcodecs: boolean;
  ffmpeg: boolean;
  isolated: boolean;
} {
  return {
    webcodecs: hasWebCodecsVideo() || hasWebCodecsAudio(),
    ffmpeg: isFfmpegSupported(),
    isolated: isCrossOriginIsolated(),
  };
}
