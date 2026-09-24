import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { filterStatuses, type HttpStatusClass } from './core';

const CLASS_COLORS: Record<HttpStatusClass, string> = {
  '1xx': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  '2xx': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  '3xx': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  '4xx': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  '5xx': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export default function HttpStatusTool() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const results = useMemo(() => filterStatuses(query), [query]);

  return (
    <div className="flex flex-col gap-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('tools.http-status.searchPlaceholder')}
        aria-label={t('tools.http-status.search')}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
      />

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('tools.http-status.count', { count: results.length })}
      </p>

      <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {results.map((s) => (
          <li key={s.code} className="flex items-start gap-3 py-2">
            <span className={`mt-0.5 rounded px-2 py-0.5 font-mono text-xs ${CLASS_COLORS[s.cls]}`}>
              {s.code}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.description}</p>
            </div>
            <CopyButton text={`${s.code} ${s.name}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}
