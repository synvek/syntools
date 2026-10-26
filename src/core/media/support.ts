/**
 * 运行时媒体能力探测。
 *
 * 音视频处理全部走浏览器的 WebCodecs + mediabunny：
 * - 编解码由浏览器原生提供，可硬件加速；
 * - 容器解封装 / 封装由 mediabunny（MPL-2.0）完成，纯 JS，不需要下载 wasm 运行时。
 *
 * 为什么不再保留 ffmpeg.wasm 兜底：公开发布的 `@ffmpeg/core-mt` 是带
 * `--enable-gpl --enable-libx264 --enable-libx265` 的 GPL 构建，随闭源的商业许可版本
 * 分发会触发 GPL 的源码开放义务（见 plan/license-audit.md）。代价是少数冷门容器与老旧
 * 编码不再支持，但失败时会明确报错，而不是静默降级。
 */

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

/**
 * 媒体文件的默认大小上限。
 * 取 2GB：解封装、编码、封装全程在内存中完成，再大就会先撞上单标签页的内存墙。
 * 真正的限制来自可用内存，而不是这个数字。
 */
export const MEDIA_MAX_BYTES = 2 * 1024 * 1024 * 1024;
