import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { FileDropZone } from '@/core/components/FileDropZone';
import { Icon } from '@/core/components/Icon';
import { downloadBlob } from '@/core/lib/download';
import {
  convertMedia,
  getSupportedTargets,
  probeMedia,
  type MediaQuality,
  type MediaTarget,
} from '@/core/media/convert';
import { hasWebCodecsAudio, MEDIA_MAX_BYTES } from '@/core/media/support';
import { downmix, encodeWav, resample, type BitDepth } from './core';

type ChannelMode = 'keep' | 'mono' | 'stereo';
type AudioTarget = 'wav' | 'mp3' | 'm4a' | 'ogg' | 'flac';

const AUDIO_TARGETS: AudioTarget[] = ['wav', 'mp3', 'm4a', 'ogg', 'flac'];
const QUALITY_LEVELS: MediaQuality[] = ['low', 'medium', 'high'];

export default function AudioConvertTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<AudioTarget>('wav');
  const [sampleRate, setSampleRate] = useState(0); // 0 = keep
  const [channelMode, setChannelMode] = useState<ChannelMode>('keep');
  const [bitDepth, setBitDepth] = useState<BitDepth>(16);
  const [quality, setQuality] = useState<MediaQuality>('medium');

  /** 当前浏览器能产出的目标格式；null 表示尚未探测完 */
  const [supported, setSupported] = useState<MediaTarget[] | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    void getSupportedTargets().then((list) => {
      if (alive) setSupported(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (supported && supported.length > 0 && !supported.includes(target)) {
      setTarget(supported.includes('wav') ? 'wav' : (supported[0] as AudioTarget));
    }
  }, [supported, target]);

  const channelsOf = (mode: ChannelMode): number | undefined =>
    mode === 'mono' ? 1 : mode === 'stereo' ? 2 : undefined;

  const onFile = async (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    setInfo(null);
    const probed = await probeMedia(f);
    if (probed.ok) {
      setInfo(
        t('tools.audio-convert.info', {
          rate: '—',
          channels: '—',
          bitDepth: '—',
          duration: probed.value.duration.toFixed(1),
        }),
      );
    }
  };

  /** WAV 精修：走浏览器原生 Web Audio 解码 + 自研 PCM 编码，可精确控制位深 */
  const convertToWav = async (source: File) => {
    const arrayBuffer = await source.arrayBuffer();
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    try {
      const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const sourceRate = decoded.sampleRate;
      let channels: Float32Array[] = [];
      for (let i = 0; i < decoded.numberOfChannels; i += 1) {
        channels.push(decoded.getChannelData(i).slice());
      }
      if (channelMode === 'mono') channels = [downmix(channels)];
      else if (channelMode === 'stereo' && channels.length === 1) {
        channels = [channels[0], channels[0]];
      }
      const targetRate = sampleRate || sourceRate;
      if (targetRate !== sourceRate) {
        channels = channels.map((c) => resample(c, sourceRate, targetRate));
      }
      const bytes = encodeWav(channels, { sampleRate: targetRate, bitDepth });
      setInfo(
        t('tools.audio-convert.info', {
          rate: targetRate,
          channels: channels.length,
          bitDepth,
          duration: decoded.duration.toFixed(1),
        }),
      );
      return { blob: new Blob([bytes], { type: 'audio/wav' }), name: 'converted.wav' };
    } finally {
      void ctx.close();
    }
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0);

    try {
      if (target === 'wav') {
        const out = await convertToWav(file);
        setResult(out);
      } else {
        const controller = new AbortController();
        abortRef.current = controller;
        const r = await convertMedia(file, {
          target,
          quality,
          signal: controller.signal,
          audio: {
            ...(channelMode !== 'keep' ? { numberOfChannels: channelsOf(channelMode) } : {}),
            ...(sampleRate ? { sampleRate } : {}),
          },
          onProgress: (ratio) => setProgress(ratio),
        });
        if (r.ok) {
          setResult({ blob: r.value.blob, name: `converted.${target}` });
        } else {
          setError(t(`tools.audio-convert.errors.${r.error}`, { defaultValue: r.error }));
        }
      }
    } catch {
      setError(t('tools.audio-convert.errors.DECODE'));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setBusy(false);
  };

  const isWav = target === 'wav';
  const webcodecs = useMemo(() => hasWebCodecsAudio(), []);
  const needsWebCodecs = !isWav && !webcodecs;

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.audio-convert.target')}
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as AudioTarget)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {AUDIO_TARGETS.map((value) => {
              const ok = !supported || supported.includes(value);
              return (
                <option key={value} value={value} disabled={!ok}>
                  {ok
                    ? value.toUpperCase()
                    : `${value.toUpperCase()} ${t('tools.audio-convert.unsupportedOption')}`}
                </option>
              );
            })}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.audio-convert.sampleRate')}
          <select
            value={sampleRate}
            onChange={(e) => setSampleRate(Number(e.target.value))}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value={0}>{t('tools.audio-convert.keep')}</option>
            <option value={22050}>22050</option>
            <option value={44100}>44100</option>
            <option value={48000}>48000</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.audio-convert.channels')}
          <select
            value={channelMode}
            onChange={(e) => setChannelMode(e.target.value as ChannelMode)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="keep">{t('tools.audio-convert.keep')}</option>
            <option value="mono">{t('tools.audio-convert.mono')}</option>
            <option value="stereo">{t('tools.audio-convert.stereo')}</option>
          </select>
        </label>
        {isWav ? (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.audio-convert.bitDepth')}
            <select
              value={bitDepth}
              onChange={(e) => setBitDepth(Number(e.target.value) as BitDepth)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value={8}>8 bit</option>
              <option value={16}>16 bit</option>
              <option value={32}>32 bit float</option>
            </select>
          </label>
        ) : (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.audio-convert.quality')}
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as MediaQuality)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              {QUALITY_LEVELS.map((value) => (
                <option key={value} value={value}>
                  {t(`tools.audio-convert.qualities.${value}`)}
                </option>
              ))}
            </select>
          </label>
        )}
      </OptionBar>

      <FileDropZone
        onFile={onFile}
        accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.wma,.aiff"
        maxBytes={MEDIA_MAX_BYTES}
        hint={t('tools.audio-convert.dropHint')}
        formats={t('tools.audio-convert.formats')}
      />

      {needsWebCodecs && (
        <p role="status" className="text-xs text-amber-700 dark:text-amber-400">
          {t('tools.audio-convert.errors.WEBCodecs_AUDIO_MISSING')}
        </p>
      )}

      {file && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {file.name}
          {info ? ` · ${info}` : ''}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={convert}
          disabled={!file || busy || needsWebCodecs || (!!supported && !supported.includes(target))}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? t('tools.audio-convert.processing') : t('tools.audio-convert.convert')}
        </button>
        {busy && !isWav && (
          <button
            type="button"
            onClick={cancel}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
          >
            {t('tools.audio-convert.cancel')}
          </button>
        )}
        {busy && !isWav && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('tools.audio-convert.progress', { percent: Math.round(progress * 100) })}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {result && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => downloadBlob(result.blob, result.name)}
            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
          >
            <Icon name="download" className="h-4 w-4" />
            {t('tools.audio-convert.download')}
          </button>
        </div>
      )}
    </div>
  );
}
