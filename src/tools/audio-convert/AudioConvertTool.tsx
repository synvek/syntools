import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { FileDropZone } from '@/core/components/FileDropZone';
import { Icon } from '@/core/components/Icon';
import { downloadBlob } from '@/core/lib/download';
import { downmix, encodeWav, resample, type BitDepth } from './core';

type ChannelMode = 'keep' | 'mono' | 'stereo';

export default function AudioConvertTool() {
  const { t } = useTranslation();
  const [sampleRate, setSampleRate] = useState(0); // 0 = keep
  const [channelMode, setChannelMode] = useState<ChannelMode>('keep');
  const [bitDepth, setBitDepth] = useState<BitDepth>(16);
  const [info, setInfo] = useState<string | null>(null);
  const [wav, setWav] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const process = async (file: File) => {
    setError(null);
    setWav(null);
    setBusy(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const sourceRate = decoded.sampleRate;

      let channels: Float32Array[] = [];
      for (let i = 0; i < decoded.numberOfChannels; i += 1) {
        channels.push(decoded.getChannelData(i).slice());
      }
      if (channelMode === 'mono') channels = [downmix(channels)];
      else if (channelMode === 'stereo' && channels.length === 1)
        channels = [channels[0], channels[0]];

      const targetRate = sampleRate || sourceRate;
      if (targetRate !== sourceRate) {
        channels = channels.map((c) => resample(c, sourceRate, targetRate));
      }

      const bytes = encodeWav(channels, { sampleRate: targetRate, bitDepth });
      setWav(new Blob([bytes], { type: 'audio/wav' }));
      setInfo(
        t('tools.audio-convert.info', {
          rate: targetRate,
          channels: channels.length,
          bitDepth,
          duration: decoded.duration.toFixed(1),
        }),
      );
      void ctx.close();
    } catch {
      setError(t('tools.audio-convert.errors.DECODE'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
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
      </OptionBar>

      <FileDropZone onFile={process} accept="audio/*" hint={t('tools.audio-convert.dropHint')} />

      {busy && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('tools.audio-convert.processing')}
        </p>
      )}
      {info && <p className="text-sm text-gray-600 dark:text-gray-300">{info}</p>}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {wav && (
        <button
          type="button"
          onClick={() => downloadBlob(wav, 'converted.wav')}
          className="inline-flex items-center gap-1 self-start rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          <Icon name="download" className="h-4 w-4" />
          {t('tools.audio-convert.downloadWav')}
        </button>
      )}
    </div>
  );
}
