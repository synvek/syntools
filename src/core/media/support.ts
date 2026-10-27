/**
 * Runtime media capability detection.
 *
 * All audio/video work goes through the browser's WebCodecs + mediabunny:
 * - codecs are native to the browser and can be hardware-accelerated;
 * - container demux / mux comes from mediabunny (MPL-2.0), pure JS with no wasm runtime download.
 *
 * Why the ffmpeg.wasm fallback is gone: the published `@ffmpeg/core-mt` builds are
 * GPL builds (`--enable-gpl --enable-libx264 --enable-libx265`), and shipping them with the
 * closed-source commercial edition triggers GPL source obligations (see plan/license-audit.md). The cost is
 * losing a few obscure containers and old codecs, but failures are explicit instead of silent.
 */

/** Whether WebCodecs video encode/decode is available. */
export function hasWebCodecsVideo(): boolean {
  return (
    typeof globalThis.VideoDecoder !== 'undefined' && typeof globalThis.VideoEncoder !== 'undefined'
  );
}

/** Whether WebCodecs audio encode/decode is available. */
export function hasWebCodecsAudio(): boolean {
  return (
    typeof globalThis.AudioDecoder !== 'undefined' && typeof globalThis.AudioEncoder !== 'undefined'
  );
}

/**
 * Default size limit for media files.
 * 2GB: demux, encode and mux all happen in memory, so anything bigger hits the per-tab memory wall.
 * The real limit is available memory, not this number.
 */
export const MEDIA_MAX_BYTES = 2 * 1024 * 1024 * 1024;
