import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SHEET_COMMANDS, type SheetCommandContext, type SheetCommandId } from '../commands';
import { formatShortcut, isMacPlatform, SHEET_SHORTCUTS } from '../shortcuts';

/**
 * Keyboard cheat sheet (P1-1).
 *
 * Labels come from the command table and keys from the binding table, so the sheet can never list a
 * shortcut that no longer exists. It also states plainly that cell-level editing shortcuts belong to
 * the sheet engine — claiming otherwise would be the kind of half-truth this project forbids.
 */

const GROUPS: Array<{ labelKey: string; ids: SheetCommandId[] }> = [
  {
    labelKey: 'shortcutGroupFile',
    ids: ['newDoc', 'importXlsx', 'exportXlsx', 'exportCsv', 'print'],
  },
  { labelKey: 'shortcutGroupFormat', ids: ['formatCells'] },
  { labelKey: 'shortcutGroupDocs', ids: ['library', 'versions'] },
];

export function ShortcutHelp({
  open,
  ctx,
  onClose,
}: {
  open: boolean;
  /** Used only to resolve translated labels */
  ctx: SheetCommandContext;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const mac = isMacPlatform();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const keysOf = (id: SheetCommandId): string => {
    const binding = SHEET_SHORTCUTS.find((entry) => entry.id === id);
    const first = binding?.keys[0];
    return first ? formatShortcut(first, mac) : '—';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.sheet.shortcutTitle')}
      data-testid="sheet-shortcut-help"
    >
      <div className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t('tools.sheet.shortcutTitle')}
        </h2>
        {GROUPS.map((group) => (
          <section key={group.labelKey} className="flex flex-col gap-1">
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
              {t(`tools.sheet.${group.labelKey}`)}
            </h3>
            <ul className="flex flex-col gap-1">
              {group.ids.map((id) => (
                <li key={id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 dark:text-gray-200">
                    {ctx.t(SHEET_COMMANDS[id].labelKey)}
                  </span>
                  <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {keysOf(id)}
                  </kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
          {t('tools.sheet.shortcutEngineNote')}
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md border border-gray-300 px-3 text-xs text-gray-600 hover:bg-black/[0.03] dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/10"
          >
            {t('tools.sheet.printCancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
