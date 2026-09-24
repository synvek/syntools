import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { filterGitCommands, GIT_CATEGORIES, type GitCategory } from './core';

export default function GitCheatsheetTool() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const filtered = filterGitCommands(query);
    return GIT_CATEGORIES.map((category) => ({
      category,
      items: filtered.filter((c) => c.category === category),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <div className="flex flex-col gap-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('tools.git-cheatsheet.searchPlaceholder')}
        aria-label={t('tools.git-cheatsheet.search')}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
      />

      {grouped.map((group) => (
        <section key={group.category} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {t(`tools.git-cheatsheet.categories.${group.category as GitCategory}`)}
          </h3>
          <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {group.items.map((item) => (
              <li key={item.command} className="flex items-center gap-3 py-2">
                <code className="flex-1 truncate rounded bg-gray-100 px-2 py-1 font-mono text-xs dark:bg-gray-800">
                  {item.command}
                </code>
                <span className="hidden w-56 shrink-0 truncate text-xs text-gray-500 sm:inline dark:text-gray-400">
                  {item.description}
                </span>
                <CopyButton text={item.command} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
