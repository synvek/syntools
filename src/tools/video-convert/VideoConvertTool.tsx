import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { FileDropZone } from '@/core/components/FileDropZone';
import { Icon } from '@/core/components/Icon';
import { downloadBlob } from '@/core/lib/download';
import {
  convertMedia,
  probeMedia,
  type MediaProbe,
  type MediaQuality,
  type MediaTarget,
} from '@/core/media/convert';
import { describeEngineSupport, MEDIA_MAX_BYTES, type MediaEngine } from '@/core/media/support';
import {
  buildConvertOptions,
  formatDuration,
  outputFileName,
  QUALITY_LEVELS,
  VIDEO_TARGETS,
} from './core';

const inputClass =
  'w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900';

export default function VideoConvertTool() {
  const { t } = useTranslation();
  const support = useMemo(() => describeEngineSupport(), []);

  const [file, setFile] = useState<File | null>(null);
  const [probe, setProbe] = useState<MediaProbe | null>(null);
  const [target, setTarget] = useState<MediaTarget>('mp4');
  const [quality, setQuality] = useState<MediaQuality>('medium');
  const [width, setWidth] = useState<number | null>(null);
  const [trimStart, setTrimStart] = useState<number | null>(null);
  const [trimEnd, setTrimEnd] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [engine, setEngine] = useState<MediaEngine | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const onFile = async (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    setProbe(null);
    const probed = await probeMedia(f);
    if (probed.ok) {
      setProbe(probed.value);
      if (probed.value.width) setWidth(probed.value.width);
    } else {
      setError(t(`tools.video-convert.errors.${probed.error}`));
    }
  };

  const convert = async () => {
    if (!file) return;
    const built = buildConvertOptions({ target, quality, width, trimStart, trimEnd });
    if (!built.ok) {
      setError(t(`tools.video-convert.errors.${built.error}`));
      return;
    }
    setError(null);
    setResult(null);
    setProgress(0);
    setBusy(true);
    setEngine(null);

    const controller = new AbortController();
    abortRef.current = controller;
    const r = await convertMedia(file, {
      ...built.value,
      signal: controller.signal,
      onProgress: (ratio, usedEngine) => {
        setProgress(ratio);
        setEngine(usedEngine);
      },
    });
    setBusy(false);
    abortRef.current = null;

    if (r.ok) {
      setEngine(r.value.engine);
      setResult({ blob: r.value.blob, name: outputFileName(file.name, target) });
    } else {
      setError(t(`tools.video-convert.errors.${r.error}`, { defaultValue: r.error }));
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setBusy(false);
  };

  const reset = () => {
    setFile(null);
    setProbe(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setEngine(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.video-convert.target')}
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as MediaTarget)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {VIDEO_TARGETS.map((value) => (
              <option key={value} value={value}>
                {value.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.video-convert.quality')}
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as MediaQuality)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {QUALITY_LEVELS.map((value) => (
              <option key={value} value={value}>
                {t(`tools.video-convert.qualities.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.video-convert.width')}
          <input
            type="number"
            min={16}
            value={width ?? ''}
            onChange={(e) => setWidth(e.target.value ? Number(e.target.value) : null)}
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.video-convert.trimStart')}
          <input
            type="number"
            min={0}
            step="0.1"
            value={trimStart ?? ''}
            onChange={(e) => setTrimStart(e.target.value ? Number(e.target.value) : null)}
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.video-convert.trimEnd')}
          <input
            type="number"
            min={0}
            step="0.1"
            value={trimEnd ?? ''}
            onChange={(e) => setTrimEnd(e.target.value ? Number(e.target.value) : null)}
            className={inputClass}
          />
        </label>
        <ClearButton onClick={reset} disabled={!file} />
      </OptionBar>

      <FileDropZone
        onFile={onFile}
        accept="video/*,.mp4,.m4v,.mov,.webm,.mkv,.avi,.ts,.mts,.m2ts"
        maxBytes={MEDIA_MAX_BYTES}
        hint={t('tools.video-convert.dropHint')}
        formats={t('tools.video-convert.formats')}
      />

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('tools.video-convert.engines', {
          webcodecs: support.webcodecs
            ? t('tools.video-convert.available')
            : t('tools.video-convert.unavailable'),
          ffmpeg: support.ffmpeg
            ? t('tools.video-convert.available')
            : t('tools.video-convert.unavailable'),
        })}
      </p>

      {file && (
        <div className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700">
          <p className="font-medium">{file.name}</p>
          {probe && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('tools.video-convert.probe', {
                duration: formatDuration(probe.duration),
                size: `${probe.width ?? '?'}×${probe.height ?? '?'}`,
                video: probe.videoCodec ?? '—',
                audio: probe.audioCodec ?? '—',
              })}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={convert}
          disabled={!file || busy}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? t('tools.video-convert.converting') : t('tools.video-convert.convert')}
        </button>
        {busy && (
          <button
            type="button"
            onClick={cancel}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
          >
            {t('tools.video-convert.cancel')}
          </button>
        )}
        {busy && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('tools.video-convert.progress', { percent: Math.round(progress * 100) })}
            {engine ? ` · ${engine === 'webcodecs' ? 'WebCodecs' : 'ffmpeg.wasm'}` : ''}
          </span>
        )}
      </div>

      {result && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => downloadBlob(result.blob, result.name)}
            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
          >
            <Icon name="download" className="h-4 w-4" />
            {t('tools.video-convert.download', { name: result.name })}
          </button>
          {engine && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('tools.video-convert.usedEngine', {
                engine: engine === 'webcodecs' ? 'WebCodecs' : 'ffmpeg.wasm',
              })}
            </span>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
