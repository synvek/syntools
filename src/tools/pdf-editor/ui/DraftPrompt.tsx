import { useTranslation } from 'react-i18next';
import type { DraftRecord } from '../io/draftStore';

/** Locale-aware "12 minutes ago" without shipping another copy block */
function relativeTime(timestamp: number, locale: string): string {
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const absolute = Math.abs(seconds);
  if (absolute < 60) return formatter.format(seconds, 'second');
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  return formatter.format(Math.round(hours / 24), 'day');
}

interface DraftPromptProps {
  draft: DraftRecord;
  /** Re-opening a model-only draft is impossible until the file is picked again */
  resumable: boolean;
  busy?: boolean;
  onResume(): void;
  onDiscard(): void;
}

/**
 * "Continue where you left off" card.
 *
 * Never restores automatically: opening someone else's old draft (or one from a different file) is
 * worse than one extra click.
 */
export function DraftPrompt({ draft, resumable, busy, onResume, onDiscard }: DraftPromptProps) {
  const { t, i18n } = useTranslation();

  return (
    <div
      role="status"
      data-testid="pdf-draft-prompt"
      className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-left dark:border-blue-900 dark:bg-blue-950/30"
    >
      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
        {t('tools.pdfEditor.draftTitle')}
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-300">
        {t('tools.pdfEditor.draftMeta', {
          name: draft.name,
          pages: draft.pageCount,
          when: relativeTime(draft.updatedAt, i18n.language),
        })}
      </p>
      {!resumable ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {t('tools.pdfEditor.draftNoSource')}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!resumable || busy}
          onClick={onResume}
          data-testid="pdf-draft-resume"
          className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
        >
          {t('tools.pdfEditor.draftContinue')}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          data-testid="pdf-draft-discard"
          className="rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-600 transition-colors motion-reduce:transition-none hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {t('tools.pdfEditor.draftDiscard')}
        </button>
      </div>
    </div>
  );
}
