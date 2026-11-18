import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router-dom';

/**
 * Route-leave confirmation for unsaved documents.
 *
 * `useBlocker` only exists in a data router. The caller mounts this component only when
 * `useInRouterContext()` is true (see `PdfEditorTool`), so component tests that render the editor
 * without a router never reach it.
 */
export function LeaveGuard({ dirty }: { dirty: boolean }) {
  const { t } = useTranslation();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  if (blocker.state !== 'blocked') return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-leave-title"
      data-testid="pdf-leave-guard"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl dark:bg-gray-900">
        <h2 id="pdf-leave-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('tools.pdfEditor.leaveTitle')}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
          {t('tools.pdfEditor.leaveBody')}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => blocker.reset()}
            data-testid="pdf-leave-stay"
            className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-100 motion-reduce:transition-none dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.pdfEditor.leaveStay')}
          </button>
          <button
            type="button"
            onClick={() => blocker.proceed()}
            data-testid="pdf-leave-confirm"
            className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 motion-reduce:transition-none"
          >
            {t('tools.pdfEditor.leaveLeave')}
          </button>
        </div>
      </div>
    </div>
  );
}
