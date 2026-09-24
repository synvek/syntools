import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { FileDropZone } from '@/core/components/FileDropZone';
import { Icon } from '@/core/components/Icon';
import { downloadBlob } from '@/core/lib/download';
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

export default function VideoToGifTool() {
  const { t } = useTranslation();
  const [start, setStart] = useState(0);
  const [duration, setDuration] = useState(3);
  const [fps, setFps] = useState(10);
  const [width, setWidth] = useState(320);
  const [gif, setGif] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const process = async (file: File) => {
    setError(null);
    setGif(null);
    setBusy(true);
    setProgress(0);
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
      const targetW = Math.min(width, video.videoWidth || width);
      const targetH = Math.max(1, Math.round(targetW * aspect));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('ctx');

      const safeStart = Math.max(0, Math.min(start, video.duration || 0));
      const safeDuration = Math.max(
        0.1,
        Math.min(duration, Math.max(0.1, (video.duration || 1) - safeStart)),
      );
      const frameCount = Math.max(1, Math.min(Math.round(safeDuration * fps), 200));
      const frames: Frame[] = [];

      for (let i = 0; i < frameCount; i += 1) {
        const time = safeStart + i / fps;
        await seek(video, Math.min(time, video.duration || time));
        ctx.drawImage(video, 0, 0, targetW, targetH);
        const { data } = ctx.getImageData(0, 0, targetW, targetH);
        frames.push({ rgba: data, width: targetW, height: targetH });
        setProgress(Math.round(((i + 1) / frameCount) * 100));
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
      URL.revokeObjectURL(url);
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

      <FileDropZone onFile={process} accept="video/*" hint={t('tools.video-to-gif.dropHint')} />

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
        </div>
      )}
    </div>
  );
}
