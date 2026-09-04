import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toPng } from 'html-to-image';
import { FileDropZone } from '@/core/components/FileDropZone';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  DEFAULT_IMAGE_CARD,
  IMAGE_CARD_ALIGNS,
  IMAGE_CARD_BACKDROP_CSS,
  IMAGE_CARD_BACKDROP_MODES,
  IMAGE_CARD_BACKDROP_PRESETS,
  IMAGE_CARD_POSITIONS,
  clampImageCard,
  isImageFile,
  resolveBackdropCss,
  type ImageCardAlign,
  type ImageCardBackdropMode,
  type ImageCardBackdropPresetId,
  type ImageCardOptions,
  type ImageCardTextPosition,
} from './core';

/** 图片转卡片制作 */
export default function ImageCardTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () =>
      readSharedState({
        p: DEFAULT_IMAGE_CARD.padding,
        r: DEFAULT_IMAGE_CARD.radius,
        sh: 1,
        w: DEFAULT_IMAGE_CARD.width,
        tp: DEFAULT_IMAGE_CARD.textPosition,
        tb: DEFAULT_IMAGE_CARD.textBg,
        ta: DEFAULT_IMAGE_CARD.textAlign,
        tpd: DEFAULT_IMAGE_CARD.textPadding,
        ts: DEFAULT_IMAGE_CARD.titleSize,
        ss: DEFAULT_IMAGE_CARD.subtitleSize,
        rot: DEFAULT_IMAGE_CARD.rotate,
        bm: DEFAULT_IMAGE_CARD.backdropMode,
        bp: DEFAULT_IMAGE_CARD.backdropPreset,
        bc: DEFAULT_IMAGE_CARD.backdropColor,
        gf: DEFAULT_IMAGE_CARD.gradientFrom,
        gt: DEFAULT_IMAGE_CARD.gradientTo,
        ga: DEFAULT_IMAGE_CARD.gradientAngle,
        title: '',
        sub: '',
      }),
    [],
  );
  const [options, setOptions] = useState<ImageCardOptions>(() =>
    clampImageCard({
      padding: Number(init.p),
      radius: Number(init.r),
      shadow: Number(init.sh) !== 0,
      width: Number(init.w),
      textPosition: init.tp as ImageCardTextPosition,
      textBg: String(init.tb),
      textAlign: init.ta as ImageCardAlign,
      textPadding: Number(init.tpd),
      titleSize: Number(init.ts),
      subtitleSize: Number(init.ss),
      rotate: Number(init.rot),
      backdropMode: init.bm as ImageCardBackdropMode,
      backdropPreset: init.bp as ImageCardBackdropPresetId,
      backdropColor: String(init.bc),
      gradientFrom: String(init.gf),
      gradientTo: String(init.gt),
      gradientAngle: Number(init.ga),
    }),
  );
  const [title, setTitle] = useState(String(init.title || ''));
  const [subtitle, setSubtitle] = useState(String(init.sub || ''));
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [error, setError] = useState<'NOT_IMAGE' | 'ENCODE' | null>(null);
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const patch = (partial: Partial<ImageCardOptions>) =>
    setOptions((prev) => clampImageCard({ ...prev, ...partial }));

  const backdrop = useMemo(() => resolveBackdropCss(options), [options]);
  const hasText = title.trim() || subtitle.trim();

  useEffect(
    () => () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    },
    [sourceUrl],
  );

  const handleFile = (file: File) => {
    if (!isImageFile(file.type)) {
      setError('NOT_IMAGE');
      return;
    }
    const url = URL.createObjectURL(file);
    setSourceUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    setError(null);
  };

  const download = async () => {
    const node = cardRef.current;
    if (!node || !sourceUrl) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `image-card-${Date.now()}.png`;
      a.click();
    } catch {
      setError('ENCODE');
    } finally {
      setExporting(false);
    }
  };

  const photo = sourceUrl ? (
    <div style={{ overflow: 'hidden', lineHeight: 0, background: '#000' }}>
      <img
        src={sourceUrl}
        alt=""
        crossOrigin="anonymous"
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          transform: options.rotate ? `rotate(${options.rotate}deg)` : undefined,
          transformOrigin: 'center center',
        }}
      />
    </div>
  ) : null;

  const textBlock = hasText ? (
    <div
      style={{
        background: options.textBg,
        padding: options.textPadding,
        textAlign: options.textAlign,
        wordBreak: 'break-word',
      }}
    >
      {title.trim() ? (
        <p
          style={{
            margin: 0,
            fontSize: options.titleSize,
            fontWeight: 700,
            lineHeight: 1.35,
            color: '#111827',
          }}
        >
          {title.trim()}
        </p>
      ) : null}
      {subtitle.trim() ? (
        <p
          style={{
            margin: title.trim() ? '6px 0 0' : 0,
            fontSize: options.subtitleSize,
            lineHeight: 1.5,
            color: '#6b7280',
          }}
        >
          {subtitle.trim()}
        </p>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageCard.textPosition')}
          <select
            value={options.textPosition}
            onChange={(e) => patch({ textPosition: e.target.value as ImageCardTextPosition })}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {IMAGE_CARD_POSITIONS.map((id) => (
              <option key={id} value={id}>
                {t(`tools.imageCard.positions.${id}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageCard.align')}
          <select
            value={options.textAlign}
            onChange={(e) => patch({ textAlign: e.target.value as ImageCardAlign })}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {IMAGE_CARD_ALIGNS.map((id) => (
              <option key={id} value={id}>
                {t(`tools.imageCard.aligns.${id}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={options.shadow}
            onChange={(e) => patch({ shadow: e.target.checked })}
            className="h-4 w-4 accent-blue-600"
          />
          {t('tools.imageCard.shadow')}
        </label>
        <button
          type="button"
          onClick={() => void download()}
          disabled={exporting || !sourceUrl}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {exporting ? t('tools.imageCard.exporting') : t('tools.imageCard.download')}
        </button>
        <ShareButton
          getState={() => ({
            p: options.padding,
            r: options.radius,
            sh: options.shadow ? 1 : 0,
            w: options.width,
            tp: options.textPosition,
            tb: options.textBg,
            ta: options.textAlign,
            tpd: options.textPadding,
            ts: options.titleSize,
            ss: options.subtitleSize,
            rot: options.rotate,
            bm: options.backdropMode,
            bp: options.backdropPreset,
            bc: options.backdropColor,
            gf: options.gradientFrom,
            gt: options.gradientTo,
            ga: options.gradientAngle,
            title: title.slice(0, 80),
            sub: subtitle.slice(0, 120),
          })}
        />
      </OptionBar>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageCard.padding')}
          <input
            type="range"
            min={8}
            max={80}
            value={options.padding}
            onChange={(e) => patch({ padding: Number(e.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="w-8 font-mono text-xs">{options.padding}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageCard.width')}
          <input
            type="range"
            min={240}
            max={1000}
            step={20}
            value={options.width}
            onChange={(e) => patch({ width: Number(e.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="w-10 font-mono text-xs">{options.width}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageCard.radius')}
          <input
            type="range"
            min={0}
            max={48}
            value={options.radius}
            onChange={(e) => patch({ radius: Number(e.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="w-8 font-mono text-xs">{options.radius}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageCard.textPadding')}
          <input
            type="range"
            min={4}
            max={48}
            value={options.textPadding}
            onChange={(e) => patch({ textPadding: Number(e.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="w-8 font-mono text-xs">{options.textPadding}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageCard.titleSize')}
          <input
            type="range"
            min={12}
            max={48}
            value={options.titleSize}
            onChange={(e) => patch({ titleSize: Number(e.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="w-8 font-mono text-xs">{options.titleSize}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageCard.subtitleSize')}
          <input
            type="range"
            min={10}
            max={36}
            value={options.subtitleSize}
            onChange={(e) => patch({ subtitleSize: Number(e.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="w-8 font-mono text-xs">{options.subtitleSize}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageCard.rotate')}
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={options.rotate}
            onChange={(e) => patch({ rotate: Number(e.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="w-10 font-mono text-xs">{options.rotate}°</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageCard.textBg')}
          <input
            type="color"
            value={options.textBg}
            onChange={(e) => patch({ textBg: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-700"
          />
        </label>
      </div>

      <section className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('tools.imageCard.backdrop')}
          </span>
          <select
            value={options.backdropMode}
            onChange={(e) => patch({ backdropMode: e.target.value as ImageCardBackdropMode })}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {IMAGE_CARD_BACKDROP_MODES.map((id) => (
              <option key={id} value={id}>
                {t(`tools.imageCard.backdropModes.${id}`)}
              </option>
            ))}
          </select>
        </div>
        {options.backdropMode === 'preset' && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {IMAGE_CARD_BACKDROP_PRESETS.map((id) => (
              <button
                key={id}
                type="button"
                title={t(`tools.imageCard.backdrops.${id}`)}
                onClick={() => patch({ backdropPreset: id })}
                className={`overflow-hidden rounded-md border text-left ${
                  options.backdropPreset === id
                    ? 'border-blue-500 ring-1 ring-blue-500'
                    : 'border-gray-200 dark:border-gray-600'
                }`}
              >
                <div className="h-10 w-full" style={{ background: IMAGE_CARD_BACKDROP_CSS[id] }} />
                <span className="block truncate px-1.5 py-1 text-[11px] text-gray-600 dark:text-gray-300">
                  {t(`tools.imageCard.backdrops.${id}`)}
                </span>
              </button>
            ))}
          </div>
        )}
        {options.backdropMode === 'color' && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.imageCard.backdropColor')}
            <input
              type="color"
              value={options.backdropColor}
              onChange={(e) => patch({ backdropColor: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-700"
            />
          </label>
        )}
        {options.backdropMode === 'gradient' && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
            <label className="flex items-center gap-2">
              {t('tools.imageCard.gradientFrom')}
              <input
                type="color"
                value={options.gradientFrom}
                onChange={(e) => patch({ gradientFrom: e.target.value })}
                className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-700"
              />
            </label>
            <label className="flex items-center gap-2">
              {t('tools.imageCard.gradientTo')}
              <input
                type="color"
                value={options.gradientTo}
                onChange={(e) => patch({ gradientTo: e.target.value })}
                className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-700"
              />
            </label>
            <label className="flex min-w-[12rem] flex-1 items-center gap-2">
              {t('tools.imageCard.gradientAngle')}
              <input
                type="range"
                min={0}
                max={360}
                value={options.gradientAngle}
                onChange={(e) => patch({ gradientAngle: Number(e.target.value) })}
                className="min-w-0 flex-1"
              />
              <span className="w-10 font-mono text-xs">{options.gradientAngle}°</span>
            </label>
          </div>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageCard.title')}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('tools.imageCard.titlePlaceholder')}
            maxLength={80}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageCard.subtitle')}
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder={t('tools.imageCard.subtitlePlaceholder')}
            maxLength={120}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
      </div>

      <FileDropZone accept="image/*" onFile={handleFile} hint={t('tools.imageCard.dropHint')} />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.imageCard.err.${error}`)}
        </p>
      )}

      <div className="overflow-auto rounded-md border border-gray-200 bg-gray-100 p-4 dark:border-gray-700 dark:bg-gray-950">
        {sourceUrl ? (
          <div
            ref={cardRef}
            className="mx-auto"
            style={{
              width: options.width,
              maxWidth: '100%',
              padding: options.padding,
              background: backdrop,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                overflow: 'hidden',
                borderRadius: options.radius,
                boxShadow: options.shadow ? '0 18px 40px rgba(0,0,0,0.18)' : 'none',
              }}
            >
              {options.textPosition === 'above' ? (
                <>
                  {textBlock}
                  {photo}
                </>
              ) : (
                <>
                  {photo}
                  {textBlock}
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-gray-400">{t('tools.imageCard.empty')}</p>
        )}
      </div>
    </div>
  );
}
