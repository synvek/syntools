import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { CopyButton } from '@/core/components/CopyButton';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  ALL_CATEGORY,
  countByCategory,
  filterPrompts,
  pickCategoryName,
  pickText,
  sortCategories,
} from './core';
import { PROMPT_CATEGORIES, PROMPTS } from './data';

/** AI 提示词库：数据驱动的多分类多语言提示词检索与一键复制 */
export default function AiPromptsTool() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'en';
  const init = useMemo(() => readSharedState({ q: '', c: ALL_CATEGORY }), []);

  const categories = useMemo(() => sortCategories(PROMPT_CATEGORIES), []);
  const counts = useMemo(() => countByCategory(PROMPTS), []);
  const metaById = useMemo(() => new Map(categories.map((meta) => [meta.id, meta])), [categories]);
  const translate = useCallback((key: string) => String(t(key)), [t]);

  const [query, setQuery] = useState(String(init.q || ''));
  const [category, setCategory] = useState<string>(() => {
    const shared = String(init.c || ALL_CATEGORY);
    return shared === ALL_CATEGORY || PROMPT_CATEGORIES.some((meta) => meta.id === shared)
      ? shared
      : ALL_CATEGORY;
  });

  // 条目较多时保证输入框跟手：列表渲染降为低优先级更新
  const deferredQuery = useDeferredValue(query);
  const list = useMemo(() => filterPrompts(deferredQuery, category), [deferredQuery, category]);

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
            onChange={(e) => setCategory(e.target.value)}
            className="max-w-[14rem] rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value={ALL_CATEGORY}>{t('tools.aiPrompts.cat.all')}</option>
            {categories.map((meta) => (
              <option key={meta.id} value={meta.id}>
                {`${pickCategoryName(meta, lang, translate)} (${counts[meta.id] ?? 0})`}
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
            const meta = metaById.get(item.category);
            const title = pickText(item.title, lang);
            const text = pickText(item.prompt, lang);
            const categoryName = meta ? pickCategoryName(meta, lang, translate) : item.category;
            return (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 [contain-intrinsic-size:auto_120px] [content-visibility:auto] dark:border-gray-700 sm:flex-row sm:items-start"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-800 dark:text-gray-100">{title}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {categoryName}
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
