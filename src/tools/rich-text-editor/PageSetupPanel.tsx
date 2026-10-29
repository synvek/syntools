import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import {
  DEFAULT_WATERMARK,
  MARGIN_PRESETS,
  mergePageSetup,
  type ColumnCount,
  type Orientation,
  type PageSetupConfig,
  type PageSetupPatch,
  type PageSize,
} from './pageSetup';

interface PageSetupPanelProps {
  setup: PageSetupConfig;
  /** Which section these settings apply to, e.g. "Section 2" (multi-section documents) */
  scopeLabel?: string;
  /**
   * Multi-section only: "link to previous" switches. Omit for the first section (nothing to link to).
   */
  linkState?: {
    header: boolean;
    footer: boolean;
    onToggle: (part: 'header' | 'footer', linked: boolean) => void;
  };
  onChange: (patch: PageSetupPatch) => void;
  onClose: () => void;
}

const fieldClass =
  'rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800';
const labelClass = 'text-xs text-gray-500 dark:text-gray-400';

/** Page setup panel: paper / orientation / margins / header & footer / page numbers / columns / watermark / background */
export function PageSetupPanel({
  setup: setupProp,
  scopeLabel,
  linkState,
  onChange,
  onClose,
}: PageSetupPanelProps) {
  const { t } = useTranslation();

  // Keep a local draft so the controls respond immediately and consecutive edits compose: the parent
  // applies changes to the editor document, and until it re-renders the `setup` prop still holds the
  // pre-edit value (two quick selects used to overwrite each other's field).
  const [setup, setSetup] = useState(setupProp);
  useEffect(() => setSetup(setupProp), [setupProp]);

  const patch = (partial: PageSetupPatch) => {
    setSetup((current) => mergePageSetup(current, partial));
    onChange(partial);
  };
  const applyPreset = (preset: keyof typeof MARGIN_PRESETS) =>
    patch({ margin: { ...MARGIN_PRESETS[preset] } });

  const watermark = setup.watermark;
  const patchWatermark = (partial: Partial<NonNullable<PageSetupConfig['watermark']>>) =>
    patch({ watermark: partial });

  return (
    <div
      data-testid="rich-text-page-setup"
      className="rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-200">
          {t('tools.richText.pageSetup')}
          {scopeLabel ? (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-normal text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {scopeLabel}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          aria-label={t('tools.richText.pageSetupClose')}
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      {linkState ? (
        <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-300">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={linkState.header}
              onChange={(event) => linkState.onToggle('header', event.target.checked)}
            />
            {t('tools.richText.linkHeader')}
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={linkState.footer}
              onChange={(event) => linkState.onToggle('footer', event.target.checked)}
            />
            {t('tools.richText.linkFooter')}
          </label>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('tools.richText.paperSize')}</span>
          <select
            value={setup.size}
            onChange={(e) => patch({ size: e.target.value as PageSize })}
            className={fieldClass}
          >
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('tools.richText.orientation')}</span>
          <select
            value={setup.orientation}
            onChange={(e) => patch({ orientation: e.target.value as Orientation })}
            className={fieldClass}
          >
            <option value="portrait">{t('tools.richText.portrait')}</option>
            <option value="landscape">{t('tools.richText.landscape')}</option>
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <span className={labelClass}>{t('tools.richText.marginPreset')}</span>
          <div className="flex gap-1">
            {(['normal', 'narrow', 'wide'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs transition-colors hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                {t(`tools.richText.margin_${preset}`)}
              </button>
            ))}
          </div>
        </div>

        {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
          <label key={side} className="flex flex-col gap-1">
            <span className={labelClass}>{t(`tools.richText.margin_${side}`)}</span>
            <input
              type="number"
              min={5}
              step={1}
              value={setup.margin[side]}
              onChange={(e) => patch({ margin: { [side]: Number(e.target.value) } })}
              className={`w-20 ${fieldClass}`}
            />
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex min-w-40 flex-1 flex-col gap-1">
          <span className={labelClass}>{t('tools.richText.headerText')}</span>
          <input
            type="text"
            value={setup.header}
            onChange={(e) => patch({ header: e.target.value })}
            placeholder={t('tools.richText.headerPlaceholder')}
            className={fieldClass}
          />
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1">
          <span className={labelClass}>{t('tools.richText.footerText')}</span>
          <input
            type="text"
            value={setup.footer}
            onChange={(e) => patch({ footer: e.target.value })}
            placeholder={t('tools.richText.footerPlaceholder')}
            className={fieldClass}
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={setup.showPageNumber}
            onChange={(e) => patch({ showPageNumber: e.target.checked })}
          />
          <span>{t('tools.richText.showPageNumber')}</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={setup.differentFirstPage}
            onChange={(e) => patch({ differentFirstPage: e.target.checked })}
          />
          <span>{t('tools.richText.differentFirstPage')}</span>
        </label>
      </div>

      {/* Columns / watermark / background: all three are about visual layout, so they share one group */}
      <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <span className={labelClass}>{t('tools.richText.columns')}</span>
            <div className="flex gap-1">
              {([1, 2, 3] as const).map((count) => {
                const active = setup.columns === count;
                return (
                  <button
                    key={count}
                    type="button"
                    aria-pressed={active}
                    onClick={() => patch({ columns: count as ColumnCount })}
                    className={`h-7 w-10 rounded-md border text-xs transition-colors ${
                      active
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
                    }`}
                  >
                    {count}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>{t('tools.richText.backgroundColor')}</span>
            <span className="flex items-center gap-1">
              <input
                type="color"
                aria-label={t('tools.richText.backgroundColor')}
                value={setup.background ?? '#ffffff'}
                onChange={(e) => patch({ background: e.target.value })}
                className="h-7 w-10 cursor-pointer rounded border border-gray-300 bg-white dark:border-gray-600"
              />
              <button
                type="button"
                onClick={() => patch({ background: null })}
                className="h-7 rounded-md border border-gray-300 px-2 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {t('tools.richText.removeBackground')}
              </button>
            </span>
          </label>
        </div>

        <label className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={watermark !== null}
            onChange={(e) =>
              patch({
                watermark: e.target.checked
                  ? { ...DEFAULT_WATERMARK, text: t('tools.richText.watermarkDefault') }
                  : null,
              })
            }
          />
          <span>{t('tools.richText.watermark')}</span>
        </label>

        {watermark ? (
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <label className="flex min-w-32 flex-1 flex-col gap-1">
              <span className={labelClass}>{t('tools.richText.watermarkText')}</span>
              <input
                type="text"
                maxLength={40}
                value={watermark.text}
                onChange={(e) => patchWatermark({ text: e.target.value })}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>
                {t('tools.richText.watermarkOpacity')} {Math.round(watermark.opacity * 100)}%
              </span>
              <input
                type="range"
                min={2}
                max={60}
                value={Math.round(watermark.opacity * 100)}
                onChange={(e) => patchWatermark({ opacity: Number(e.target.value) / 100 })}
                className="w-32"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>
                {t('tools.richText.watermarkRotation')} {watermark.rotation}°
              </span>
              <input
                type="range"
                min={-90}
                max={90}
                value={watermark.rotation}
                onChange={(e) => patchWatermark({ rotation: Number(e.target.value) })}
                className="w-32"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>{t('tools.richText.watermarkColor')}</span>
              <input
                type="color"
                aria-label={t('tools.richText.watermarkColor')}
                value={watermark.color}
                onChange={(e) => patchWatermark({ color: e.target.value })}
                className="h-7 w-10 cursor-pointer rounded border border-gray-300 bg-white dark:border-gray-600"
              />
            </label>
          </div>
        ) : null}

        {setup.columns > 1 ? (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            {t('tools.richText.columnsPagedHint')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
