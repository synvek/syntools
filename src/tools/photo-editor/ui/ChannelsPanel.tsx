import { useTranslation } from 'react-i18next';
import { CHANNEL_LIST, channelThumbnail } from '../render/channels';
import { usePhotoStore } from '../store';
import type { ChannelView } from '../core';

/**
 * Channels panel: thumbnails and isolated display for composite / R / G / B, plus sample points and the document palette.
 *
 * Isolated display is a **display state** (affects only the canvas, never the document or history): it is for inspecting a
 * single channel's clipping / noise / mask detail, which is what channels are actually used for in retouching.
 * The document palette, by contrast, is document data (saved with the project), so it has its own block with its source labelled.
 */

/** i18n keys for channel names: `rgb` reuses the "composite" label */
const CHANNEL_LABEL: Record<ChannelView, string> = {
  rgb: 'channelRgb',
  red: 'channelRed',
  green: 'channelGreen',
  blue: 'channelBlue',
};

export function ChannelsPanel() {
  const { t } = useTranslation();
  const doc = usePhotoStore((s) => s.doc);
  const channelView = usePhotoStore((s) => s.channelView);
  const setChannelView = usePhotoStore((s) => s.setChannelView);
  const loadChannelSelection = usePhotoStore((s) => s.loadChannelSelection);
  const samples = usePhotoStore((s) => s.samples);
  const removeSample = usePhotoStore((s) => s.removeSample);
  const clearSamples = usePhotoStore((s) => s.clearSamples);
  const addSwatch = usePhotoStore((s) => s.addSwatch);
  const removeSwatch = usePhotoStore((s) => s.removeSwatch);
  const extractSwatches = usePhotoStore((s) => s.extractSwatches);
  const foreground = usePhotoStore((s) => s.brush.color);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {t('tools.photo.channels')}
        </span>
        <div className="flex flex-wrap gap-2">
          {CHANNEL_LIST.map((channel) => {
            const active = channelView === channel;
            return (
              <button
                key={channel}
                type="button"
                data-testid={`channel-${channel}`}
                aria-pressed={active}
                title={t(`tools.photo.${CHANNEL_LABEL[channel]}`)}
                onClick={() => setChannelView(active ? 'rgb' : channel)}
                className={`flex w-16 flex-col items-center gap-1 rounded-lg border p-1 transition-colors ${
                  active
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                }`}
              >
                <span className="flex h-10 w-14 items-center justify-center overflow-hidden rounded border border-gray-200 bg-[#0B1220] dark:border-gray-700">
                  <img
                    src={channelThumbnail(doc, channel)}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </span>
                <span className="text-[10px] text-gray-600 dark:text-gray-300">
                  {t(`tools.photo.${CHANNEL_LABEL[channel]}`)}
                </span>
              </button>
            );
          })}
        </div>
        {channelView !== 'rgb' ? (
          <button
            type="button"
            data-testid="channel-to-selection"
            onClick={loadChannelSelection}
            className="w-fit rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {t('tools.photo.channelToSelection')}
          </button>
        ) : (
          <p className="text-[10px] leading-4 text-gray-400 dark:text-gray-500">
            {t('tools.photo.channelHint')}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {t('tools.photo.samples')}
          </span>
          {samples.length > 0 ? (
            <button
              type="button"
              data-testid="samples-clear"
              onClick={clearSamples}
              className="text-[10px] text-gray-400 hover:text-red-500"
            >
              {t('tools.photo.sampleClear')}
            </button>
          ) : null}
        </div>
        {samples.length === 0 ? (
          <p className="text-[10px] leading-4 text-gray-400 dark:text-gray-500">
            {t('tools.photo.samplesHint')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {samples.map((sample, index) => (
              <li
                key={`${sample.x}-${sample.y}-${index}`}
                data-testid={`sample-${index}`}
                className="flex items-center gap-2 rounded border border-gray-200 px-1.5 py-1 text-[11px] dark:border-gray-700"
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-sm border border-gray-300 dark:border-gray-600"
                  style={{ background: sample.hex }}
                />
                <span className="font-mono text-gray-600 dark:text-gray-300">{sample.hex}</span>
                <span className="min-w-0 flex-1 truncate text-gray-400">
                  {Math.round(sample.x)}, {Math.round(sample.y)}
                </span>
                {sample.alpha === 0 ? (
                  <span className="text-[10px] text-amber-500">
                    {t('tools.photo.sampleTransparent')}
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-label={`${t('tools.photo.delete')} ${index + 1}`}
                  onClick={() => removeSample(index)}
                  className="text-gray-400 hover:text-red-500"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {t('tools.photo.docSwatches')}
        </span>
        {doc.swatches.length === 0 ? (
          <p className="text-[10px] leading-4 text-gray-400 dark:text-gray-500">
            {t('tools.photo.docSwatchesHint')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {doc.swatches.map((color, index) => (
              <button
                key={`${color}-${index}`}
                type="button"
                data-testid={`swatch-${index}`}
                title={color}
                onClick={() => removeSwatch(index)}
                className="h-6 w-6 rounded border border-gray-300 transition-transform hover:scale-110 dark:border-gray-600"
                style={{ background: color }}
              />
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            data-testid="swatch-extract"
            onClick={extractSwatches}
            className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {t('tools.photo.swatchExtract')}
          </button>
          <button
            type="button"
            data-testid="swatch-add"
            onClick={() => addSwatch(foreground)}
            title={foreground}
            className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <span
              className="h-3 w-3 rounded-sm border border-gray-300 dark:border-gray-600"
              style={{ background: foreground }}
            />
            {t('tools.photo.swatchAdd')}
          </button>
        </div>
        <p className="text-[10px] leading-4 text-gray-400 dark:text-gray-500">
          {t('tools.photo.swatchHint')}
        </p>
      </div>
    </div>
  );
}
