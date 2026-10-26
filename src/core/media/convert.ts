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
 * 每个目标容器实际需要的编码器（数组内为「任选其一」，全部满足才算可转）。
 *
 * 这不是照抄规格书，而是跟 mediabunny 的自动选码保持一致的实测口径：
 * Chrome 只提供 AAC 与 Opus 音频编码器，MP3 / Vorbis / FLAC 根本没有，
 * 所以「MP3」这类目标在部分浏览器上不可达 —— 与其让用户点完才发现失败，
 * 不如在渲染选项时就把不可用的条目标出来。
 */
const TARGET_CAPABILITY: Record<MediaTarget, { video?: VideoCodec[]; audio?: AudioCodec[] }> = {
  mp4: { video: ['avc'], audio: ['aac'] },
  webm: { video: ['vp9', 'vp8'], audio: ['opus'] },
  mkv: { video: ['avc', 'vp9'], audio: ['aac', 'opus'] },
  mp3: { audio: ['mp3'] },
  m4a: { audio: ['aac'] },
  wav: {}, // 自研 PCM 编码，不依赖 WebCodecs
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
    // 用 720p 探测：过低的分辨率可能命中软件编码器而高估能力
    if (await canEncodeVideo(codec, { width: 1280, height: 720 })) return true;
  }
  return false;
}

/** 当前浏览器能否产出该目标格式。 */
export async function isTargetSupported(target: MediaTarget): Promise<boolean> {
  const need = TARGET_CAPABILITY[target];
  if (!need.video && !need.audio) return true;
  if (need.audio && !(await anyAudioEncodable(need.audio))) return false;
  if (need.video && !(await anyVideoEncodable(need.video))) return false;
  return true;
}

/** 一次性探测全部目标格式，返回可用的那部分（供下拉框过滤）。 */
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

/** 读取媒体基本信息（时长、轨道、编码），失败时返回错误码。 */
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
  /** 秒；end 省略表示到结尾 */
  trim?: { start?: number; end?: number };
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}

export interface ConvertMediaResult {
  blob: Blob;
}

/** 音频专用输出格式 */
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
 * 转换媒体：WebCodecs 解码 + 编码，mediabunny 负责容器。
 * 浏览器缺少对应能力时返回明确的错误码，由 UI 提示，而不是静默降级到别的引擎。
 */
export async function convertMedia(
  file: Blob,
  options: ConvertMediaOptions,
): Promise<ToolResult<ConvertMediaResult>> {
  return convertWithWebCodecs(file, options);
}
