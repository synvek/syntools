import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useModalBehavior } from '@/core/hooks/useOverlayStack';

interface PrintPreviewDialogProps {
  open: boolean;
  /** Sanitized document HTML — the same prepared HTML used by print / PDF / single-file export */
  html: string;
  /** Page-setup CSS variables so the preview matches the exported page geometry */
  cssVars?: Record<string, string>;
  onClose: () => void;
  onPrint: () => void;
}

/**
 * Print preview (implementation plan P0-3.1).
 *
 * It renders the *same* sanitized `printHtml` that `PrintLayer` and the PDF exporter consume, with the
 * same page-setup variables, so the preview and the exported page cannot drift apart. Printing from
 * this dialog delegates to the existing text-mode print pipeline instead of opening a second one.
 */
export function PrintPreviewDialog({
  open,
  html,
  cssVars,
  onClose,
  onPrint,
}: PrintPreviewDialogProps) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // P0-4: the shared stack handles topmost-only Escape, Tab trap and focus restore
  useModalBehavior(open, onClose);

  // Initial focus stays on the close button so keyboard users can dismiss immediately
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const sheet: CSSProperties = {
    width: 'var(--rte-page-width, 210mm)',
    minHeight: 'var(--rte-page-height, 297mm)',
    paddingTop: 'var(--rte-page-margin-top, 20mm)',
    paddingRight: 'var(--rte-page-margin-right, 20mm)',
    paddingBottom: 'var(--rte-page-margin-bottom, 20mm)',
    paddingLeft: 'var(--rte-page-margin-left, 20mm)',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rte-print-preview-title"
        aria-describedby="rte-print-preview-desc"
        data-testid="rich-text-print-preview"
        className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 px-4 py-2 dark:border-gray-700">
          <div className="min-w-0">
            <h2
              id="rte-print-preview-title"
              className="text-base font-semibold text-gray-900 dark:text-gray-100"
            >
              {t('tools.richText.printPreview')}
            </h2>
            <p
              id="rte-print-preview-desc"
              className="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
            >
              {t('tools.richText.printPreviewHint')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {t('tools.richText.printPreviewClose')}
            </button>
            <button
              type="button"
              data-testid="rich-text-print-now"
              onClick={onPrint}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              {t('tools.richText.print')}
            </button>
          </div>
        </div>

        <div
          className="flex-1 overflow-auto bg-gray-100 p-6 dark:bg-gray-950"
          style={cssVars as CSSProperties | undefined}
        >
          <div
            className="mx-auto bg-white text-gray-900 shadow-lg dark:bg-white"
            style={sheet}
            data-testid="rich-text-print-preview-sheet"
          >
            <div
              className="rte-print-flow"
              style={{ width: 'var(--rte-content-width, 170mm)' }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
