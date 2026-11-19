import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const HINT_KEY = 'syntools.pdf-editor.patch-hint';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * One-time notice for the patch tool: "this covers the line, it does not reflow the page".
 *
 * Dismissal is stored per browser. Storage failures (private mode) only cost a repeated notice — the
 * patch itself must never depend on it.
 */
export function PatchHint({ onDismiss }: { onDismiss?(): void }) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      // Preference does not persist; the notice simply appears again next time
    }
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      role="note"
      data-testid="pdf-patch-hint"
      className="flex items-start justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
    >
      <span>{t('tools.pdfEditor.patchHint')}</span>
      <button
        type="button"
        onClick={dismiss}
        data-testid="pdf-patch-hint-dismiss"
        className="shrink-0 rounded px-1 underline decoration-dotted hover:no-underline"
      >
        {t('tools.pdfEditor.patchHintDismiss')}
      </button>
    </div>
  );
}
