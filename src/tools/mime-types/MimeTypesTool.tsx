import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { filterMimes } from './core';

export default function MimeTypesTool() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const results = useMemo(() => filterMimes(query), [query]);

  return (
    <div className="flex flex-col gap-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('tools.mime-types.searchPlaceholder')}
        aria-label={t('tools.mime-types.search')}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
      />

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('tools.mime-types.count', { count: results.length })}
      </p>

      <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {results.map((m) => (
          <li key={m.ext} className="flex items-center gap-3 py-2">
            <code className="w-16 shrink-0 text-sm text-gray-500 dark:text-gray-400">{m.ext}</code>
            <code className="min-w-0 flex-1 truncate text-sm">{m.mime}</code>
            <CopyButton text={m.mime} />
          </li>
        ))}
      </ul>
    </div>
  );
}
