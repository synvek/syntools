import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { CopyButton } from '@/core/components/CopyButton';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { filterPrompts, getPromptText, getPromptTitle } from './core';
import { PROMPT_CATEGORIES, type PromptCategory } from './prompts';

/** AI 提示词库（prompts 懒加载自本目录） */
export default function AiPromptsTool() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('zh') ? 'zh' : 'en';
  const init = useMemo(() => readSharedState({ q: '', c: 'all' }), []);
  const [query, setQuery] = useState(String(init.q || ''));
  const [category, setCategory] = useState<PromptCategory | 'all'>(
    PROMPT_CATEGORIES.includes(init.c as PromptCategory) ? (init.c as PromptCategory) : 'all',
  );

  const list = useMemo(() => filterPrompts(query, category), [query, category]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.aiPrompts.search')}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('tools.aiPrompts.searchPlaceholder')}
            className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.aiPrompts.category')}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as PromptCategory | 'all')}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="all">{t('tools.aiPrompts.cat.all')}</option>
            {PROMPT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`tools.aiPrompts.cat.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <ShareButton getState={() => ({ q: query, c: category })} />
      </OptionBar>

      {list.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.aiPrompts.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((item) => {
            const title = getPromptTitle(item, lang);
            const text = getPromptText(item, lang);
            return (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-700 sm:flex-row sm:items-start"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-800 dark:text-gray-100">{title}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {t(`tools.aiPrompts.cat.${item.category}`)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words font-mono text-xs text-gray-600 dark:text-gray-300">
                    {text}
                  </p>
                </div>
                <CopyButton text={text} label={t('common.copy')} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
