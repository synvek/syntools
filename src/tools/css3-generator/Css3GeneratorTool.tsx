import { useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { CopyButton } from '@/core/components/CopyButton';
import { IOTextArea } from '@/core/components/IOTextArea';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  CSS3_MODULES,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BOX_SHADOW,
  DEFAULT_FILTER,
  DEFAULT_TEXT_SHADOW,
  DEFAULT_TRANSFORM,
  DEFAULT_TRANSITION,
  buildCss3ForModule,
  cssDeclToStyle,
  type BorderRadiusOptions,
  type BoxShadowOptions,
  type Css3Module,
  type FilterOptions,
  type TextShadowOptions,
  type TransformOptions,
  type TransitionOptions,
} from './core';

const TIMINGS = ['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out'] as const;

/** CSS3 代码生成器 */
export default function Css3GeneratorTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ m: 'borderRadius' }), []);
  const [module, setModule] = useState<Css3Module>(
    CSS3_MODULES.includes(init.m as Css3Module) ? (init.m as Css3Module) : 'borderRadius',
  );
  const [borderRadius, setBorderRadius] = useState<BorderRadiusOptions>(DEFAULT_BORDER_RADIUS);
  const [boxShadow, setBoxShadow] = useState<BoxShadowOptions>(DEFAULT_BOX_SHADOW);
  const [textShadow, setTextShadow] = useState<TextShadowOptions>(DEFAULT_TEXT_SHADOW);
  const [transform, setTransform] = useState<TransformOptions>(DEFAULT_TRANSFORM);
  const [transition, setTransition] = useState<TransitionOptions>(DEFAULT_TRANSITION);
  const [filter, setFilter] = useState<FilterOptions>(DEFAULT_FILTER);

  const css = useMemo(
    () =>
      buildCss3ForModule(module, {
        borderRadius,
        boxShadow,
        textShadow,
        transform,
        transition,
        filter,
      }),
    [module, borderRadius, boxShadow, textShadow, transform, transition, filter],
  );

  const previewStyle = useMemo(() => {
    const base: CSSProperties = {
      width: 160,
      height: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
      color: '#fff',
      fontWeight: 600,
      fontSize: 14,
      ...cssDeclToStyle(css),
    };
    if (module === 'textShadow') {
      return {
        ...base,
        background: '#f3f4f6',
        color: '#111827',
        fontSize: 28,
      } as CSSProperties;
    }
    if (module === 'transition') {
      return { ...base, ...cssDeclToStyle(css) } as CSSProperties;
    }
    return base;
  }, [css, module]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <div className="flex flex-wrap gap-1">
          {CSS3_MODULES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModule(m)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                module === m
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              {t(`tools.css3Generator.modules.${m}`)}
            </button>
          ))}
        </div>
        <ShareButton getState={() => ({ m: module })} />
      </OptionBar>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
          {module === 'borderRadius' && (
            <>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={borderRadius.linked}
                  onChange={(e) => {
                    const linked = e.target.checked;
                    setBorderRadius((prev) =>
                      linked
                        ? {
                            ...prev,
                            linked,
                            topRight: prev.topLeft,
                            bottomRight: prev.topLeft,
                            bottomLeft: prev.topLeft,
                          }
                        : { ...prev, linked },
                    );
                  }}
                  className="h-4 w-4 accent-blue-600"
                />
                {t('tools.css3Generator.linked')}
              </label>
              {(
                [
                  ['topLeft', 'topLeft'],
                  ['topRight', 'topRight'],
                  ['bottomRight', 'bottomRight'],
                  ['bottomLeft', 'bottomLeft'],
                ] as const
              ).map(([key, field]) => (
                <SliderRow
                  key={key}
                  label={t(`tools.css3Generator.${key}`)}
                  value={borderRadius[field]}
                  min={0}
                  max={64}
                  onChange={(v) =>
                    setBorderRadius((prev) =>
                      prev.linked
                        ? {
                            topLeft: v,
                            topRight: v,
                            bottomRight: v,
                            bottomLeft: v,
                            linked: true,
                          }
                        : { ...prev, [field]: v },
                    )
                  }
                  disabled={borderRadius.linked && field !== 'topLeft'}
                />
              ))}
            </>
          )}

          {module === 'boxShadow' && (
            <>
              <SliderRow
                label={t('tools.css3Generator.offsetX')}
                value={boxShadow.offsetX}
                min={-40}
                max={40}
                onChange={(v) => setBoxShadow((p) => ({ ...p, offsetX: v }))}
              />
              <SliderRow
                label={t('tools.css3Generator.offsetY')}
                value={boxShadow.offsetY}
                min={-40}
                max={40}
                onChange={(v) => setBoxShadow((p) => ({ ...p, offsetY: v }))}
              />
              <SliderRow
                label={t('tools.css3Generator.blur')}
                value={boxShadow.blur}
                min={0}
                max={80}
                onChange={(v) => setBoxShadow((p) => ({ ...p, blur: v }))}
              />
              <SliderRow
                label={t('tools.css3Generator.spread')}
                value={boxShadow.spread}
                min={-40}
                max={40}
                onChange={(v) => setBoxShadow((p) => ({ ...p, spread: v }))}
              />
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                {t('tools.css3Generator.color')}
                <input
                  type="text"
                  value={boxShadow.color}
                  onChange={(e) => setBoxShadow((p) => ({ ...p, color: e.target.value }))}
                  className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-900"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={boxShadow.inset}
                  onChange={(e) => setBoxShadow((p) => ({ ...p, inset: e.target.checked }))}
                  className="h-4 w-4 accent-blue-600"
                />
                {t('tools.css3Generator.inset')}
              </label>
            </>
          )}

          {module === 'textShadow' && (
            <>
              <SliderRow
                label={t('tools.css3Generator.offsetX')}
                value={textShadow.offsetX}
                min={-20}
                max={20}
                onChange={(v) => setTextShadow((p) => ({ ...p, offsetX: v }))}
              />
              <SliderRow
                label={t('tools.css3Generator.offsetY')}
                value={textShadow.offsetY}
                min={-20}
                max={20}
                onChange={(v) => setTextShadow((p) => ({ ...p, offsetY: v }))}
              />
              <SliderRow
                label={t('tools.css3Generator.blur')}
                value={textShadow.blur}
                min={0}
                max={40}
                onChange={(v) => setTextShadow((p) => ({ ...p, blur: v }))}
              />
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                {t('tools.css3Generator.color')}
                <input
                  type="text"
                  value={textShadow.color}
                  onChange={(e) => setTextShadow((p) => ({ ...p, color: e.target.value }))}
                  className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-900"
                />
              </label>
            </>
          )}

          {module === 'transform' && (
            <>
              <SliderRow
                label={t('tools.css3Generator.translateX')}
                value={transform.translateX}
                min={-80}
                max={80}
                onChange={(v) => setTransform((p) => ({ ...p, translateX: v }))}
              />
              <SliderRow
                label={t('tools.css3Generator.translateY')}
                value={transform.translateY}
                min={-80}
                max={80}
                onChange={(v) => setTransform((p) => ({ ...p, translateY: v }))}
              />
              <SliderRow
                label={t('tools.css3Generator.rotate')}
                value={transform.rotate}
                min={-180}
                max={180}
                onChange={(v) => setTransform((p) => ({ ...p, rotate: v }))}
              />
              <SliderRow
                label={t('tools.css3Generator.scale')}
                value={transform.scale}
                min={0.2}
                max={2}
                step={0.05}
                onChange={(v) => setTransform((p) => ({ ...p, scale: v }))}
              />
              <SliderRow
                label={t('tools.css3Generator.skewX')}
                value={transform.skewX}
                min={-45}
                max={45}
                onChange={(v) => setTransform((p) => ({ ...p, skewX: v }))}
              />
            </>
          )}

          {module === 'transition' && (
            <>
              <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                {t('tools.css3Generator.property')}
                <input
                  type="text"
                  value={transition.property}
                  onChange={(e) => setTransition((p) => ({ ...p, property: e.target.value }))}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              </label>
              <SliderRow
                label={t('tools.css3Generator.duration')}
                value={transition.duration}
                min={0}
                max={3}
                step={0.05}
                onChange={(v) => setTransition((p) => ({ ...p, duration: v }))}
              />
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                {t('tools.css3Generator.timing')}
                <select
                  value={transition.timing}
                  onChange={(e) => setTransition((p) => ({ ...p, timing: e.target.value }))}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  {TIMINGS.map((tm) => (
                    <option key={tm} value={tm}>
                      {tm}
                    </option>
                  ))}
                </select>
              </label>
              <SliderRow
                label={t('tools.css3Generator.delay')}
                value={transition.delay}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) => setTransition((p) => ({ ...p, delay: v }))}
              />
            </>
          )}

          {module === 'filter' && (
            <>
              <SliderRow
                label={t('tools.css3Generator.blur')}
                value={filter.blur}
                min={0}
                max={20}
                onChange={(v) => setFilter((p) => ({ ...p, blur: v }))}
              />
              <SliderRow
                label={t('tools.css3Generator.brightness')}
                value={filter.brightness}
                min={0}
                max={200}
                onChange={(v) => setFilter((p) => ({ ...p, brightness: v }))}
              />
              <SliderRow
                label={t('tools.css3Generator.contrast')}
                value={filter.contrast}
                min={0}
                max={200}
                onChange={(v) => setFilter((p) => ({ ...p, contrast: v }))}
              />
              <SliderRow
                label={t('tools.css3Generator.saturate')}
                value={filter.saturate}
                min={0}
                max={200}
                onChange={(v) => setFilter((p) => ({ ...p, saturate: v }))}
              />
              <SliderRow
                label={t('tools.css3Generator.grayscale')}
                value={filter.grayscale}
                min={0}
                max={100}
                onChange={(v) => setFilter((p) => ({ ...p, grayscale: v }))}
              />
              <SliderRow
                label={t('tools.css3Generator.hueRotate')}
                value={filter.hueRotate}
                min={0}
                max={360}
                onChange={(v) => setFilter((p) => ({ ...p, hueRotate: v }))}
              />
            </>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('tools.css3Generator.preview')}
          </p>
          <div className="flex min-h-[180px] items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
            <div style={previewStyle}>{t('tools.css3Generator.previewLabel')}</div>
          </div>
          <IOTextArea
            label={t('tools.css3Generator.css')}
            value={css}
            rows={4}
            readOnly
            actions={<CopyButton text={css} />}
          />
        </div>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
      <span className="w-28 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 accent-blue-600 disabled:opacity-40"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 rounded-md border border-gray-300 bg-white px-1 py-0.5 font-mono text-xs disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900"
      />
    </label>
  );
}
