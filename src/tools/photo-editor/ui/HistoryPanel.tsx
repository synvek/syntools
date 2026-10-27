import { useTranslation } from 'react-i18next';
import { usePhotoStore } from '../store';
import { historyTimeline } from '../core';

/**
 * History panel: lists the timeline by action name; clicking any row jumps to the state after that step.
 *
 * Row semantics live in `core.historyTimeline`:
 * - row 0 = the initial state when the document was opened / created;
 * - the highlighted row = the current state;
 * - rows after it = steps that can be redone (greyed out).
 */
export function HistoryPanel() {
  const { t } = useTranslation();
  const past = usePhotoStore((s) => s.past);
  const future = usePhotoStore((s) => s.future);
  const jumpTo = usePhotoStore((s) => s.jumpTo);
  const clearHistory = usePhotoStore((s) => s.clearHistory);

  const rows = historyTimeline(past, future);
  const currentIndex = past.length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {t('tools.photo.historyCount', { n: rows.length })}
        </span>
        <button
          type="button"
          data-testid="history-clear"
          onClick={clearHistory}
          disabled={rows.length <= 1}
          className="rounded px-1.5 py-0.5 text-[11px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          {t('tools.photo.historyClear')}
        </button>
      </div>

      <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto" data-testid="history-list">
        {rows.map((row, index) => {
          const beyond = index > currentIndex;
          return (
            <li key={`${row.label}-${index}`}>
              <button
                type="button"
                data-testid={`history-row-${index}`}
                data-current={row.current ? 'true' : undefined}
                aria-current={row.current ? 'step' : undefined}
                onClick={() => jumpTo(index)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12px] transition-colors ${
                  row.current
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                    : beyond
                      ? 'text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <span className="w-4 shrink-0 text-right font-mono text-[10px] text-gray-400">
                  {index}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {t(`tools.photo.${row.label}`)}
                  {row.current ? (
                    <span className="ml-1 text-[10px] text-gray-400">
                      {t('tools.photo.historyCurrent')}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
