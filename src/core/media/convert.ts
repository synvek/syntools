import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  FlacOutputFormat,
  Input,
  Mp3OutputFormat,
  Mp4OutputFormat,
  OggOutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  WavOutputFormat,
  WebMOutputFormat,
  type InputFormat,
  type OutputFormat,
  type Quality,
} from 'mediabunny';
import type { ToolResult } from '@/core/types';
import { runFfmpeg } from './ffmpeg';
import { hasWebCodecsAudio, hasWebCodecsVideo, type MediaEngine } from './support';

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
  { value: 'ogg', label: 'OGG (Vorbis)', kind: 'audio' },
  { value: 'flac', label: 'FLAC', kind: 'audio' },
];

export function isAudioTarget(target: MediaTarget): boolean {
  return AUDIO_TARGETS.includes(target);
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
  onProgress?: (ratio: number, engine: MediaEngine) => void;
  signal?: AbortSignal;
}

export interface ConvertMediaResult {
  blob: Blob;
  engine: MediaEngine;
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
      conversion.onProgress = (ratio) => options.onProgress?.(ratio, 'webcodecs');
    }
    if (options.signal) {
      options.signal.addEventListener('abort', () => void conversion.cancel(), { once: true });
    }

    await conversion.execute();

    const buffer = output.target.buffer;
    if (!buffer) return { ok: false, error: 'OUTPUT_MISSING' };
    return {
      ok: true,
      value: { blob: new Blob([buffer], { type: mimeOf(options.target) }), engine: 'webcodecs' },
    };
  } catch {
    return { ok: false, error: 'WEBCodecs_FAILED' };
  } finally {
    disposeInput(input);
  }
}

function defaultVideoFormat(target: MediaTarget): OutputFormat {
  if (target === 'webm') return new WebMOutputFormat();
  return new Mp4OutputFormat(); // mp4 / mkv 由 mp4 容器承载（mkv 由 ffmpeg 兜底）
}

function crfFor(quality: MediaQuality | undefined): string {
  if (quality === 'low') return '30';
  if (quality === 'high') return '20';
  return '24';
}

function vp9CrfFor(quality: MediaQuality | undefined): string {
  if (quality === 'low') return '40';
  if (quality === 'high') return '28';
  return '34';
}

async function convertWithFfmpeg(
  file: Blob,
  options: ConvertMediaOptions,
): Promise<ToolResult<ConvertMediaResult>> {
  const audioOnly = isAudioTarget(options.target);
  const inputName = `input.${audioOnly ? 'bin' : 'bin'}`;
  const outputName = `output.${options.target}`;
  const args: string[] = [];

  if (options.trim?.start) args.push('-ss', String(options.trim.start));
  if (options.trim?.end != null) args.push('-to', String(options.trim.end));
  args.push('-i', inputName);

  switch (options.target) {
    case 'mp4':
      args.push(
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        crfFor(options.quality),
        '-c:a',
        'aac',
        '-b:a',
        '192k',
      );
      break;
    case 'webm':
      args.push(
        '-c:v',
        'libvpx-vp9',
        '-crf',
        vp9CrfFor(options.quality),
        '-b:v',
        '0',
        '-c:a',
        'libopus',
        '-b:a',
        '128k',
      );
      break;
    case 'mkv':
      args.push('-c', 'copy');
      break;
    case 'mp3':
      args.push('-vn', '-c:a', 'libmp3lame', '-q:a', '2');
      break;
    case 'm4a':
      args.push('-vn', '-c:a', 'aac', '-b:a', '192k');
      break;
    case 'wav':
      args.push('-vn', '-c:a', 'pcm_s16le');
      break;
    case 'ogg':
      args.push('-vn', '-c:a', 'libvorbis', '-q:a', '5');
      break;
    case 'flac':
      args.push('-vn', '-c:a', 'flac');
      break;
  }

  // `-c copy`（mkv）与滤镜互斥，仅在转码路径下缩放
  if (!audioOnly && options.target !== 'mkv' && options.video?.width) {
    args.push('-vf', `scale=${Math.max(2, Math.round(options.video.width))}:-2`);
  }
  args.push(outputName);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await runFfmpeg({
    args,
    inputs: [{ name: inputName, data: bytes }],
    output: outputName,
    onProgress: options.onProgress ? (ratio) => options.onProgress?.(ratio, 'ffmpeg') : undefined,
  });
  if (!result.ok) return result;
  return {
    ok: true,
    value: { blob: new Blob([result.value], { type: mimeOf(options.target) }), engine: 'ffmpeg' },
  };
}

/**
 * 转换媒体：优先 WebCodecs（原生、零下载），失败或不支持时回退到 ffmpeg.wasm。
 * 返回值会带上实际使用的引擎，供 UI 提示用户。
 */
export async function convertMedia(
  file: Blob,
  options: ConvertMediaOptions,
): Promise<ToolResult<ConvertMediaResult>> {
  const attempts: string[] = [];

  const webcodecs = await convertWithWebCodecs(file, options);
  if (webcodecs.ok) return webcodecs;
  attempts.push(webcodecs.error);

  const ffmpeg = await convertWithFfmpeg(file, options);
  if (ffmpeg.ok) return ffmpeg;
  attempts.push(ffmpeg.error);

  // 优先暴露更有意义的失败原因（引擎不支持 vs 处理失败）
  const primary = attempts.find((code) => code.includes('WEBCodecs') || code === 'NEED_ISOLATION');
  return { ok: false, error: primary ?? attempts[0] ?? 'CONVERT_FAILED' };
}
