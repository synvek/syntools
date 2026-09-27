import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import {
  MARGIN_PRESETS,
  type Orientation,
  type PageMargins,
  type PageSetupConfig,
  type PageSize,
} from './pageSetup';

interface PageSetupPanelProps {
  setup: PageSetupConfig;
  onChange: (next: PageSetupConfig) => void;
  onClose: () => void;
}

/** 页面设置面板：纸张 / 方向 / 边距 / 页眉 / 页脚 / 页码 */
export function PageSetupPanel({ setup, onChange, onClose }: PageSetupPanelProps) {
  const { t } = useTranslation();

  const patch = (partial: Partial<PageSetupConfig>) => onChange({ ...setup, ...partial });
  const patchMargin = (partial: Partial<PageMargins>) =>
    onChange({ ...setup, margin: { ...setup.margin, ...partial } });
  const applyPreset = (preset: keyof typeof MARGIN_PRESETS) =>
    onChange({ ...setup, margin: { ...MARGIN_PRESETS[preset] } });

  return (
    <div
      data-testid="rich-text-page-setup"
      className="rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-gray-700 dark:text-gray-200">
          {t('tools.richText.pageSetup')}
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

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('tools.richText.paperSize')}
          </span>
          <select
            value={setup.size}
            onChange={(e) => patch({ size: e.target.value as PageSize })}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
          >
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('tools.richText.orientation')}
          </span>
          <select
            value={setup.orientation}
            onChange={(e) => patch({ orientation: e.target.value as Orientation })}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
          >
            <option value="portrait">{t('tools.richText.portrait')}</option>
            <option value="landscape">{t('tools.richText.landscape')}</option>
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('tools.richText.marginPreset')}
          </span>
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
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t(`tools.richText.margin_${side}`)}
            </span>
            <input
              type="number"
              min={5}
              step={1}
              value={setup.margin[side]}
              onChange={(e) => patchMargin({ [side]: Number(e.target.value) })}
              className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
            />
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex min-w-40 flex-1 flex-col gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('tools.richText.headerText')}
          </span>
          <input
            type="text"
            value={setup.header}
            onChange={(e) => patch({ header: e.target.value })}
            placeholder={t('tools.richText.headerPlaceholder')}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
          />
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('tools.richText.footerText')}
          </span>
          <input
            type="text"
            value={setup.footer}
            onChange={(e) => patch({ footer: e.target.value })}
            placeholder={t('tools.richText.footerPlaceholder')}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
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
      </div>
    </div>
  );
}
