import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  FlacOutputFormat,
  Input,
  MkvOutputFormat,
  Mp3OutputFormat,
  Mp4OutputFormat,
  OggOutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  WavOutputFormat,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
  type AudioCodec,
  type InputFormat,
  type OutputFormat,
  type Quality,
  type VideoCodec,
} from 'mediabunny';
import type { ToolResult } from '@/core/types';
import { hasWebCodecsAudio, hasWebCodecsVideo } from './support';

export type MediaTarget = 'mp4' | 'webm' | 'mkv' | 'mp3' | 'wav' | 'ogg' | 'flac' | 'm4a';
export type MediaQuality = 'low' | 'medium' | 'high';

const AUDIO_TARGETS: MediaTarget[] = ['mp3', 'wav', 'ogg', 'flac', 'm4a'];

export const MEDIA_TARGETS: { value: MediaTarget; label: string; kind: 'video' | 'audio' }[] = [
  { value: 'mp4', label: 'MP4 (H.264/AAC)', kind: 'video' },
  { value: 'webm', label: 'WebM (VP9/Opus)', kind: 'video' },
  { value: 'mkv', label: 'MKV', kind: 'video' },
  { value: 'mp3', label: 'MP3', kind: 'audio' },
  { value: 'm4a', label: 'M4A (AAC)', kind: 'audio' },
  { value: 'wav', label: 'WAV', kind: 'audio' },
  { value: 'ogg', label: 'OGG (Opus)', kind: 'audio' },
  { value: 'flac', label: 'FLAC', kind: 'audio' },
];

export function isAudioTarget(target: MediaTarget): boolean {
  return AUDIO_TARGETS.includes(target);
}

/**
 * Encoders each target container actually needs (within an array any one suffices; all arrays must pass).
 *
 * This follows what mediabunny's automatic codec pick really does, rather than the spec sheet:
 * Chrome ships only AAC and Opus audio encoders — no MP3 / Vorbis / FLAC at all,
 * so targets like "MP3" are unreachable in some browsers. Better to mark unavailable entries
 * while rendering the options than to fail once the user commits.
 */
const TARGET_CAPABILITY: Record<MediaTarget, { video?: VideoCodec[]; audio?: AudioCodec[] }> = {
  mp4: { video: ['avc'], audio: ['aac'] },
  webm: { video: ['vp9', 'vp8'], audio: ['opus'] },
  mkv: { video: ['avc', 'vp9'], audio: ['aac', 'opus'] },
  mp3: { audio: ['mp3'] },
  m4a: { audio: ['aac'] },
  wav: {}, // in-house PCM encoder, no WebCodecs needed
  ogg: { audio: ['opus', 'vorbis'] },
  flac: { audio: ['flac'] },
};

async function anyAudioEncodable(codecs: AudioCodec[]): Promise<boolean> {
  for (const codec of codecs) {
    if (await canEncodeAudio(codec)) return true;
  }
  return false;
}

async function anyVideoEncodable(codecs: VideoCodec[]): Promise<boolean> {
  for (const codec of codecs) {
    // Probe at 720p: a low resolution may land on a software encoder and overstate support
    if (await canEncodeVideo(codec, { width: 1280, height: 720 })) return true;
  }
  return false;
}

/** Whether this browser can produce the target format. */
export async function isTargetSupported(target: MediaTarget): Promise<boolean> {
  const need = TARGET_CAPABILITY[target];
  if (!need.video && !need.audio) return true;
  if (need.audio && !(await anyAudioEncodable(need.audio))) return false;
  if (need.video && !(await anyVideoEncodable(need.video))) return false;
  return true;
}

/** Probe every target format once and return the usable ones (for filtering the dropdown). */
export async function getSupportedTargets(): Promise<MediaTarget[]> {
  const results = await Promise.all(
    MEDIA_TARGETS.map(async (item) => ((await isTargetSupported(item.value)) ? item.value : null)),
  );
  return results.filter((value): value is MediaTarget => value !== null);
}

export interface MediaProbe {
  duration: number;
  hasVideo: boolean;
  hasAudio: boolean;
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
}

function mimeOf(target: MediaTarget): string {
  switch (target) {
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mkv':
      return 'video/x-matroska';
    case 'mp3':
      return 'audio/mpeg';
    case 'm4a':
      return 'audio/mp4';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'flac':
      return 'audio/flac';
  }
}

function qualityOf(level: MediaQuality | undefined): Quality {
  if (level === 'low') return QUALITY_LOW;
  if (level === 'high') return QUALITY_HIGH;
  return QUALITY_MEDIUM;
}

function openInput(file: Blob): Input {
  return new Input({ source: new BlobSource(file), formats: ALL_FORMATS as InputFormat[] });
}

function disposeInput(input: Input): void {
  (input as { dispose?: () => void }).dispose?.();
}

/** Read basic media info (duration, tracks, codecs); returns an error code on failure. */
export async function probeMedia(file: Blob): Promise<ToolResult<MediaProbe>> {
  const input = openInput(file);
  try {
    const [duration, videoTrack, audioTrack] = await Promise.all([
      input.computeDuration(),
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack(),
    ]);
    return {
      ok: true,
      value: {
        duration,
        hasVideo: videoTrack !== null,
        hasAudio: audioTrack !== null,
        width: videoTrack?.displayWidth,
        height: videoTrack?.displayHeight,
        videoCodec: videoTrack?.codec ?? undefined,
        audioCodec: audioTrack?.codec ?? undefined,
      },
    };
  } catch {
    return { ok: false, error: 'PROBE_FAILED' };
  } finally {
    disposeInput(input);
  }
}

export interface ConvertMediaOptions {
  target: MediaTarget;
  quality?: MediaQuality;
  video?: { width?: number; height?: number; fit?: 'contain' | 'cover' | 'fill' };
  audio?: { numberOfChannels?: number; sampleRate?: number };
  /** Seconds; omitting end means until the end */
  trim?: { start?: number; end?: number };
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}

export interface ConvertMediaResult {
  blob: Blob;
}

/** Audio-only output formats */
function audioFormatOf(target: MediaTarget): OutputFormat | null {
  if (target === 'mp3') return new Mp3OutputFormat();
  if (target === 'wav') return new WavOutputFormat();
  if (target === 'ogg') return new OggOutputFormat();
  if (target === 'flac') return new FlacOutputFormat();
  if (target === 'm4a') return new Mp4OutputFormat({ fastStart: 'in-memory' });
  return null;
}

async function convertWithWebCodecs(
  file: Blob,
  options: ConvertMediaOptions,
): Promise<ToolResult<ConvertMediaResult>> {
  const audioOnly = isAudioTarget(options.target);
  if (audioOnly && !hasWebCodecsAudio()) return { ok: false, error: 'WEBCodecs_AUDIO_MISSING' };
  if (!audioOnly && !hasWebCodecsVideo()) return { ok: false, error: 'WEBCodecs_VIDEO_MISSING' };

  const input = openInput(file);
  const output = new Output({
    format: audioFormatOf(options.target) ?? defaultVideoFormat(options.target),
    target: new BufferTarget(),
  });

  try {
    const conversion = await Conversion.init({
      input,
      output,
      showWarnings: false,
      trim: options.trim ? { start: options.trim.start, end: options.trim.end } : undefined,
      video: audioOnly
        ? { discard: true }
        : {
            ...(options.video?.width ? { width: options.video.width } : {}),
            ...(options.video?.height ? { height: options.video.height } : {}),
            ...(options.video?.fit ? { fit: options.video.fit } : {}),
            quality: qualityOf(options.quality),
          },
      audio: {
        ...(options.audio?.numberOfChannels
          ? { numberOfChannels: options.audio.numberOfChannels }
          : {}),
        ...(options.audio?.sampleRate ? { sampleRate: options.audio.sampleRate } : {}),
        quality: qualityOf(options.quality),
      },
    });

    if (!conversion.isValid) return { ok: false, error: 'NO_ENCODABLE_CODEC' };

    if (options.onProgress) {
      conversion.onProgress = (ratio) => options.onProgress?.(ratio);
    }
    if (options.signal) {
      options.signal.addEventListener('abort', () => void conversion.cancel(), { once: true });
    }

    await conversion.execute();

    const buffer = output.target.buffer;
    if (!buffer) return { ok: false, error: 'OUTPUT_MISSING' };
    return {
      ok: true,
      value: { blob: new Blob([buffer], { type: mimeOf(options.target) }) },
    };
  } catch {
    return { ok: false, error: 'WEBCodecs_FAILED' };
  } finally {
    disposeInput(input);
  }
}

function defaultVideoFormat(target: MediaTarget): OutputFormat {
  if (target === 'webm') return new WebMOutputFormat();
  if (target === 'mkv') return new MkvOutputFormat();
  return new Mp4OutputFormat();
}

/**
 * Convert media: WebCodecs decodes and encodes, mediabunny handles containers.
 * Missing browser capabilities return an explicit error code for the UI instead of silently swapping engines.
 */
export async function convertMedia(
  file: Blob,
  options: ConvertMediaOptions,
): Promise<ToolResult<ConvertMediaResult>> {
  return convertWithWebCodecs(file, options);
}
