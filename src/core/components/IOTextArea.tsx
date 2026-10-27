import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

const WARN_BYTES = 500 * 1024; // 500KB: warn about performance
const MAX_BYTES = 5 * 1024 * 1024; // 5MB: reject and point users to file mode

interface IOTextAreaProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  rows?: number;
  /** Header actions on the right (e.g. copy button) */
  actions?: ReactNode;
}

/** Shared tool input/output panel (tech design §7.2) */
export function IOTextArea({
  label,
  value,
  onChange,
  readOnly = false,
  placeholder,
  rows = 8,
  actions,
}: IOTextAreaProps) {
  const { t } = useTranslation();
  const [overflowMessage, setOverflowMessage] = useState<string | null>(null);
  const bytes = new TextEncoder().encode(value).length;

  const handleChange = (next: string) => {
    if (!onChange) return;
    if (new TextEncoder().encode(next).length > MAX_BYTES) {
      setOverflowMessage(t('io.overflow'));
      return;
    }
    setOverflowMessage(null);
    onChange(next);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <label className="shrink-0 text-sm font-medium text-gray-600 dark:text-gray-300">
          {label}
        </label>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <span className="whitespace-nowrap text-xs text-gray-400 dark:text-gray-500">
            {t('io.stats', { chars: value.length, bytes })}
          </span>
          {actions}
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        rows={rows}
        aria-label={label}
        spellCheck={false}
        className="box-border w-full flex-1 resize-y rounded-lg border border-gray-300 bg-white p-3 font-mono text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-400 dark:focus:ring-blue-400"
      />
      {!readOnly && bytes > WARN_BYTES && !overflowMessage && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{t('io.warnLarge')}</p>
      )}
      {overflowMessage && (
        <p className="text-xs text-red-600 dark:text-red-400">{overflowMessage}</p>
      )}
    </div>
  );
}
