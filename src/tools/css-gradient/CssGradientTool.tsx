import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { CopyButton } from '@/core/components/CopyButton';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  DEFAULT_GRADIENT,
  GRADIENT_PRESET_CATEGORY_IDS,
  buildGradientCss,
  buildGradientValue,
  getPresetsByCategory,
  presetToOptions,
  type GradientOptions,
  type GradientPresetCategoryId,
  type GradientStop,
  type GradientType,
} from './core';

/** CSS 渐变生成器 */
export default function CssGradientTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () =>
      readSharedState({
        t: DEFAULT_GRADIENT.type,
        a: DEFAULT_GRADIENT.angle,
        sh: DEFAULT_GRADIENT.shape,
        s: JSON.stringify(DEFAULT_GRADIENT.stops),
      }),
    [],
  );

  const [options, setOptions] = useState<GradientOptions>(() => {
    let stops = DEFAULT_GRADIENT.stops;
    try {
      const parsed = JSON.parse(String(init.s || '[]')) as GradientStop[];
      if (Array.isArray(parsed) && parsed.length >= 2) stops = parsed;
    } catch {
      /* keep default */
    }
    return {
      type: init.t === 'radial' ? 'radial' : 'linear',
      angle: Number(init.a) || DEFAULT_GRADIENT.angle,
      shape: init.sh === 'ellipse' ? 'ellipse' : 'circle',
      stops,
    };
  });

  const [presetCategory, setPresetCategory] = useState<GradientPresetCategoryId>('warm');
  const categoryPresets = useMemo(
    () => getPresetsByCategory(presetCategory),
    [presetCategory],
  );

  const css = useMemo(() => buildGradientCss(options), [options]);
  const value = useMemo(() => buildGradientValue(options), [options]);

  const patch = (partial: Partial<GradientOptions>) =>
    setOptions((prev) => ({ ...prev, ...partial }));

  const updateStop = (index: number, partial: Partial<GradientStop>) => {
    setOptions((prev) => ({
      ...prev,
      stops: prev.stops.map((s, i) => (i === index ? { ...s, ...partial } : s)),
    }));
  };

  const addStop = () => {
    setOptions((prev) => ({
      ...prev,
      stops: [...prev.stops, { color: '#ffffff', position: 50 }],
    }));
  };

  const removeStop = (index: number) => {
    setOptions((prev) => {
      if (prev.stops.length <= 2) return prev;
      return { ...prev, stops: prev.stops.filter((_, i) => i !== index) };
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.cssGradient.type')}
          <select
            value={options.type}
            onChange={(e) => patch({ type: e.target.value as GradientType })}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="linear">{t('tools.cssGradient.linear')}</option>
            <option value="radial">{t('tools.cssGradient.radial')}</option>
          </select>
        </label>
        {options.type === 'linear' ? (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.cssGradient.angle')}
            <input
              type="number"
              min={0}
              max={360}
              value={options.angle}
              onChange={(e) => patch({ angle: Number(e.target.value) })}
              className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            °
          </label>
        ) : (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.cssGradient.shape')}
            <select
              value={options.shape}
              onChange={(e) =>
                patch({ shape: e.target.value === 'ellipse' ? 'ellipse' : 'circle' })
              }
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="circle">circle</option>
              <option value="ellipse">ellipse</option>
            </select>
          </label>
        )}
        <ShareButton
          getState={() => ({
            t: options.type,
            a: options.angle,
            sh: options.shape,
            s: JSON.stringify(options.stops),
          })}
        />
      </OptionBar>

      <div
        className="h-40 w-full rounded-lg border border-gray-200 dark:border-gray-700"
        style={{ background: value }}
        role="img"
        aria-label={t('tools.cssGradient.preview')}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('tools.cssGradient.stops')}
          </p>
          <button
            type="button"
            onClick={addStop}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.cssGradient.addStop')}
          </button>
        </div>
        {options.stops.map((stop, index) => (
          <div
            key={index}
            className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
          >
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(stop.color) ? stop.color : '#000000'}
              onChange={(e) => updateStop(index, { color: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-700"
            />
            <input
              type="text"
              value={stop.color}
              onChange={(e) => updateStop(index, { color: e.target.value })}
              className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-900"
            />
            <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
              {t('tools.cssGradient.position')}
              <input
                type="number"
                min={0}
                max={100}
                value={stop.position}
                onChange={(e) => updateStop(index, { position: Number(e.target.value) })}
                className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-900"
              />
              %
            </label>
            <button
              type="button"
              onClick={() => removeStop(index)}
              disabled={options.stops.length <= 2}
              className="ml-auto text-xs text-red-600 disabled:opacity-40 dark:text-red-400"
            >
              {t('tools.cssGradient.removeStop')}
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('tools.cssGradient.css')}
          </p>
          <CopyButton text={css} />
        </div>
        <pre className="overflow-x-auto rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
          {css}
        </pre>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('tools.cssGradient.presetsTitle')}
          </p>
          <select
            value={presetCategory}
            onChange={(e) => setPresetCategory(e.target.value as GradientPresetCategoryId)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            aria-label={t('tools.cssGradient.presetsTitle')}
          >
            {GRADIENT_PRESET_CATEGORY_IDS.map((id) => (
              <option key={id} value={id}>
                {t(`tools.cssGradient.presetCategories.${id}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {categoryPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={t(`tools.cssGradient.presetNames.${preset.id}`)}
              onClick={() => setOptions(presetToOptions(preset))}
              className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 text-left transition hover:border-blue-400 hover:ring-1 hover:ring-blue-400 dark:border-gray-600 dark:hover:border-blue-500"
            >
              <div
                className="h-14 w-full"
                style={{ background: buildGradientValue(preset.options) }}
                aria-hidden
              />
              <span className="truncate px-2 py-1.5 text-xs text-gray-700 group-hover:text-blue-700 dark:text-gray-200 dark:group-hover:text-blue-300">
                {t(`tools.cssGradient.presetNames.${preset.id}`)}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
