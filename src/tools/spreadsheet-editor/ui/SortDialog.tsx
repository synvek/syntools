import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_SORT_KEYS, type SortColumn, type SortKey } from '../sorting';

/**
 * "排序" dialog (P1-5) — up to three keys, header-aware.
 *
 * The engine executes the sort; this dialog only decides the keys. It states plainly that formulas
 * travel with their row and that merged cells cannot be sorted, because those are the two ways a
 * user can be surprised by a sort that "looked" correct.
 */

export interface SortDialogProps {
  open: boolean;
  columns: SortColumn[];
  /** Default of the "数据包含标题" checkbox, detected from the selection */
  hasHeader: boolean;
  onApply: (keys: SortKey[], hasHeader: boolean) => void;
  onClose: () => void;
}

export function SortDialog({ open, columns, hasHeader, onApply, onClose }: SortDialogProps) {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<SortKey[]>([{ column: 0, ascending: true }]);
  const [header, setHeader] = useState(hasHeader);

  useEffect(() => {
    if (!open) return;
    setKeys([{ column: 0, ascending: true }]);
    setHeader(hasHeader);
  }, [open, hasHeader]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const update = (index: number, patch: Partial<SortKey>) =>
    setKeys((current) => current.map((key, i) => (i === index ? { ...key, ...patch } : key)));

  const inputClass =
    'h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-800 outline-none focus:border-green-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.sheet.sortTitle')}
      data-testid="sheet-sort-dialog"
    >
      <div className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t('tools.sheet.sortTitle')}
        </h2>

        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={header}
            data-testid="sheet-sort-header"
            onChange={(event) => setHeader(event.target.checked)}
          />
          {t('tools.sheet.sortHasHeader')}
        </label>

        <ul className="flex flex-col gap-2">
          {keys.map((key, index) => (
            <li key={index} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-[11px] text-gray-400">
                {t('tools.sheet.sortThen')}
              </span>
              <select
                value={key.column}
                data-testid={`sheet-sort-column-${index}`}
                onChange={(event) => update(index, { column: Number(event.target.value) })}
                className={`${inputClass} flex-1`}
              >
                {columns.map((column) => (
                  <option key={column.index} value={column.index}>
                    {column.label}
                  </option>
                ))}
              </select>
              <select
                value={key.ascending ? 'asc' : 'desc'}
                data-testid={`sheet-sort-order-${index}`}
                onChange={(event) => update(index, { ascending: event.target.value === 'asc' })}
                className={inputClass}
              >
                <option value="asc">{t('tools.sheet.r.sortAsc')}</option>
                <option value="desc">{t('tools.sheet.r.sortDesc')}</option>
              </select>
              <button
                type="button"
                aria-label={t('tools.sheet.sortRemoveLevel')}
                disabled={keys.length === 1}
                onClick={() => setKeys((current) => current.filter((_, i) => i !== index))}
                className="h-8 w-8 rounded-md border border-gray-300 text-xs text-gray-500 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400"
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        {keys.length < Math.min(MAX_SORT_KEYS, columns.length) ? (
          <button
            type="button"
            data-testid="sheet-sort-add"
            onClick={() =>
              setKeys((current) => {
                const used = new Set(current.map((key) => key.column));
                const next = columns.find((column) => !used.has(column.index))?.index ?? 0;
                return [...current, { column: next, ascending: true }];
              })
            }
            className="self-start rounded-md border border-dashed border-gray-300 px-2 py-1 text-[11px] text-gray-600 hover:bg-black/[0.03] dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/10"
          >
            + {t('tools.sheet.sortAddLevel')}
          </button>
        ) : null}

        <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
          {t('tools.sheet.sortNote')}
        </p>

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
            data-testid="sheet-sort-apply"
            onClick={() => onApply(keys, header)}
            className="h-8 rounded-md bg-green-700 px-3 text-xs font-medium text-white hover:bg-green-800"
          >
            {t('tools.sheet.r.numberApply')}
          </button>
        </div>
      </div>
    </div>
  );
}
