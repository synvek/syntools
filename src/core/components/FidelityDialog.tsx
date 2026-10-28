import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  hasFidelityIssues,
  SEVERITY_ORDER,
  type FidelityReport,
  type FidelitySeverity,
} from '@/core/fidelity';

const SEVERITY_LABEL_KEY: Record<FidelitySeverity, string> = {
  loss: 'common.fidelityLoss',
  warning: 'common.fidelityWarning',
  info: 'common.fidelityInfo',
};

const SEVERITY_TONE: Record<FidelitySeverity, string> = {
  loss: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-gray-500 dark:text-gray-400',
};

/**
 * Unified post-import / post-export report: what was lost, what was degraded, and why.
 * Informational only — it never blocks the main flow, and closing it changes nothing.
 */
export function FidelityDialog({
  report,
  onClose,
  onMute,
  muted = false,
}: {
  report: FidelityReport | null;
  onClose: () => void;
  /** Persist "don't show again" for this browser */
  onMute?: () => void;
  muted?: boolean;
}) {
  const { t } = useTranslation();
  const [dontShow, setDontShow] = useState(muted);

  if (!report || !hasFidelityIssues(report)) return null;

  const groups = SEVERITY_ORDER.map((severity) => ({
    severity,
    issues: report.issues.filter((issue) => issue.severity === severity),
  })).filter((group) => group.issues.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('common.fidelityTitle')}
    >
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('common.fidelityTitle')}
          </h2>
          <span className="text-[12px] text-gray-500 dark:text-gray-400">
            {report.operation === 'import'
              ? t('common.fidelityImport')
              : t('common.fidelityExport')}
          </span>
        </header>

        <div className="mt-3 flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
          {groups.map((group) => (
            <section key={group.severity}>
              <h3 className={`text-[12px] font-medium ${SEVERITY_TONE[group.severity]}`}>
                {t(SEVERITY_LABEL_KEY[group.severity])}
              </h3>
              <ul className="mt-1 list-disc pl-5 text-[12px] text-gray-700 dark:text-gray-200">
                {group.issues.map((issue) => (
                  <li key={`${issue.severity}:${issue.code}`}>
                    {t(issue.messageKey, { count: issue.count })}
                    {issue.detail ? (
                      <span className="ml-1 text-gray-500 dark:text-gray-400">
                        （{issue.detail}）
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="mt-4 flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(event) => {
                setDontShow(event.target.checked);
                if (event.target.checked) onMute?.();
              }}
            />
            {t('common.fidelityDontShow')}
          </label>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-[12px] text-white transition-colors hover:bg-blue-700"
          >
            {t('common.fidelityClose')}
          </button>
        </footer>
      </div>
    </div>
  );
}
