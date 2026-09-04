/**
 * 通用进度条：支持确定进度（0–1）与不确定（indeterminate）模式。
 */
export function ProgressBar({
  value,
  label,
  indeterminate = false,
}: {
  /** 0–1；indeterminate 时忽略 */
  value?: number;
  label?: string;
  indeterminate?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, value ?? 0));
  return (
    <div className="w-full" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={indeterminate ? undefined : Math.round(pct * 100)} aria-label={label}>
      {label && <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">{label}</p>}
      <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        {indeterminate ? (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-600" style={{ animation: 'progress-indeterminate 1.2s ease-in-out infinite' }} />
        ) : (
          <div
            className="h-full rounded-full bg-blue-600 transition-[width] duration-200"
            style={{ width: `${pct * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}
