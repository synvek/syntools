import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SHORTCUT_GROUPS } from '../model/shortcuts';

/**
 * Shortcut help overlay.
 *
 * Content comes from `model/shortcuts.ts` (same source as the implementation) and it sets `aria-modal`,
 * so the editor's global shortcuts step aside automatically (see the keydown guard in FlowchartTool).
 */
export function ShortcutHelpDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('tools.flowchart.shortcutHelp')}
        data-testid="flowchart-shortcut-dialog"
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-gray-800 dark:text-gray-100">
            {t('tools.flowchart.shortcutHelp')}
          </h2>
          <button
            ref={closeRef}
            type="button"
            data-testid="flowchart-shortcut-close"
            onClick={onClose}
            className="rounded-md border border-gray-200 px-2 py-1 text-[12px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {t('tools.flowchart.closeDialog')}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.titleKey}>
              <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t(`tools.flowchart.${group.titleKey}`)}
              </h3>
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => (
                  <li key={item.labelKey} className="flex items-baseline justify-between gap-3">
                    <span className="text-[12px] text-gray-600 dark:text-gray-300">
                      {t(`tools.flowchart.${item.labelKey}`)}
                    </span>
                    <kbd className="shrink-0 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                      {item.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
