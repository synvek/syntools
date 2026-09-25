import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { FileDropZone } from '@/core/components/FileDropZone';
import { Icon } from '@/core/components/Icon';
import { downloadBlob } from '@/core/lib/download';
import { extractFramesWebCodecs } from '@/core/media/frames';
import { MEDIA_MAX_BYTES } from '@/core/media/support';
import { framesToGif } from './core';

interface Frame {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
  });
}

interface FallbackOptions {
  start: number;
  duration: number;
  fps: number;
  width: number;
  onProgress: (percent: number) => void;
}

/**
 * 兜底抽帧：`<video>` + seek + canvas。
 * 精度与速度都不如 WebCodecs，但几乎全浏览器可用（含不支持 WebCodecs 的环境）。
 */
async function extractViaVideoElement(
  file: File,
  options: FallbackOptions,
): Promise<{ ok: true; value: Frame[] } | { ok: false; error: string }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('load'));
    });

    const aspect = video.videoHeight / video.videoWidth || 0.5625;
    const targetW = Math.min(options.width, video.videoWidth || options.width);
    const targetH = Math.max(1, Math.round(targetW * aspect));
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('ctx');

    const safeStart = Math.max(0, Math.min(options.start, video.duration || 0));
    const safeDuration = Math.max(
      0.1,
      Math.min(options.duration, Math.max(0.1, (video.duration || 1) - safeStart)),
    );
    const frameCount = Math.max(1, Math.min(Math.round(safeDuration * options.fps), 200));
    const frames: Frame[] = [];
    for (let i = 0; i < frameCount; i += 1) {
      const time = safeStart + i / options.fps;
      await seek(video, Math.min(time, video.duration || time));
      ctx.drawImage(video, 0, 0, targetW, targetH);
      const { data } = ctx.getImageData(0, 0, targetW, targetH);
      frames.push({ rgba: data, width: targetW, height: targetH });
      options.onProgress(Math.round(((i + 1) / frameCount) * 100));
    }
    return { ok: true, value: frames };
  } catch {
    return { ok: false, error: 'PROCESS' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function VideoToGifTool() {
  const { t } = useTranslation();
  const [start, setStart] = useState(0);
  const [duration, setDuration] = useState(3);
  const [fps, setFps] = useState(10);
  const [width, setWidth] = useState(320);
  const [gif, setGif] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [engine, setEngine] = useState<'webcodecs' | 'video' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const process = async (file: File) => {
    setError(null);
    setGif(null);
    setBusy(true);
    setProgress(0);
    setEngine(null);

    try {
      // 优先 WebCodecs：帧更准、速度更快；不支持时回退 <video> + seek
      let frames: Frame[];
      const viaWebCodecs = await extractFramesWebCodecs(file, {
        start,
        duration,
        fps,
        width,
        maxFrames: 200,
        onProgress: (ratio) => setProgress(Math.round(ratio * 100)),
      });
      if (viaWebCodecs.ok) {
        frames = viaWebCodecs.value;
        setEngine('webcodecs');
      } else {
        const viaVideo = await extractViaVideoElement(file, {
          start,
          duration,
          fps,
          width,
          onProgress: setProgress,
        });
        if (!viaVideo.ok) {
          setError(t(`tools.video-to-gif.errors.${viaVideo.error}`));
          return;
        }
        frames = viaVideo.value;
        setEngine('video');
      }

      const r = framesToGif(frames, fps);
      if (r.ok) {
        const blob = new Blob([r.value], { type: 'image/gif' });
        setGif((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { blob, url: URL.createObjectURL(blob) };
        });
      } else setError(t(`tools.video-to-gif.errors.${r.error}`));
    } catch {
      setError(t('tools.video-to-gif.errors.PROCESS'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.video-to-gif.start')}
          <input
            type="number"
            step="0.1"
            min={0}
            value={start}
            onChange={(e) => setStart(Number(e.target.value) || 0)}
            className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.video-to-gif.duration')}
          <input
            type="number"
            step="0.1"
            min={0.1}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value) || 0.1)}
            className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.video-to-gif.fps')}
          <input
            type="number"
            min={1}
            max={30}
            value={fps}
            onChange={(e) => setFps(Math.min(30, Math.max(1, Number(e.target.value) || 10)))}
            className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.video-to-gif.width')}
          <input
            type="number"
            min={80}
            max={800}
            value={width}
            onChange={(e) => setWidth(Math.min(800, Math.max(80, Number(e.target.value) || 320)))}
            className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
      </OptionBar>

      <FileDropZone
        onFile={process}
        accept="video/*,.mp4,.m4v,.mov,.webm,.mkv,.avi,.ts,.mts,.m2ts"
        maxBytes={MEDIA_MAX_BYTES}
        hint={t('tools.video-to-gif.dropHint')}
        formats={t('tools.video-to-gif.formats')}
      />

      {busy && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('tools.video-to-gif.processing', { percent: progress })}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {gif && (
        <div className="flex flex-col items-start gap-2">
          <img
            src={gif.url}
            alt={t('tools.video-to-gif.preview')}
            className="max-w-full rounded-lg border border-gray-200 dark:border-gray-700"
          />
          <button
            type="button"
            onClick={() => downloadBlob(gif.blob, 'animation.gif')}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            <Icon name="download" className="h-4 w-4" />
            {t('tools.video-to-gif.downloadGif')}
          </button>
          {engine && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('tools.video-to-gif.usedEngine', {
                engine: engine === 'webcodecs' ? 'WebCodecs' : '<video>',
              })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
