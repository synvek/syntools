import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NUMBER_FORMAT_PRESETS } from '../sheetFormat';

/**
 * Custom number format (Excel's "自定义格式" dialog).
 *
 * Univer ships a number-format UI package but exposes no operation to open it, and re-implementing the
 * full format builder is out of scope — a pattern field with the presets as starting points covers the
 * real-world need (e.g. `#,##0.0,"K"`).
 */
export function NumberFormatDialog({
  open,
  initial,
  onApply,
  onClose,
}: {
  open: boolean;
  initial: string;
  onApply: (pattern: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [pattern, setPattern] = useState(initial);

  useEffect(() => {
    if (open) setPattern(initial);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.sheet.r.numberCustom')}
      data-testid="sheet-number-format-dialog"
    >
      <div className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t('tools.sheet.r.numberCustom')}
        </h2>
        <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
          {t('tools.sheet.r.numberFormat')}
          <input
            autoFocus
            value={pattern}
            data-testid="sheet-number-format-input"
            onChange={(event) => setPattern(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onApply(pattern.trim());
            }}
            className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-800 outline-none focus:border-green-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {NUMBER_FORMAT_PRESETS.filter((preset) => preset.pattern).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setPattern(preset.pattern)}
              className="rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-black/[0.04] dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/10"
            >
              {t(`tools.sheet.r.${preset.labelKey}`)}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md border border-gray-300 px-3 text-xs text-gray-600 hover:bg-black/[0.03] dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/10"
          >
            {t('tools.sheet.printCancel')}
          </button>
          <button
            type="button"
            data-testid="sheet-number-format-apply"
            onClick={() => onApply(pattern.trim())}
            className="h-8 rounded-md bg-green-700 px-3 text-xs font-medium text-white hover:bg-green-800"
          >
            {t('tools.sheet.r.numberApply')}
          </button>
        </div>
      </div>
    </div>
  );
}
