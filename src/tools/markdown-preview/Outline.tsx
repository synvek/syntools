import { useTranslation } from 'react-i18next';
import type { MarkdownOutlineItem } from './core';

interface OutlineProps {
  items: MarkdownOutlineItem[];
  onSelect: (item: MarkdownOutlineItem) => void;
}

/** 文档大纲：标题层级缩进排列，点击在编辑器 / 预览之间跳转 */
export function Outline({ items, onSelect }: OutlineProps) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('tools.markdown.outline')}
      className="flex min-w-0 flex-col overflow-hidden rounded-md border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900"
    >
      <span className="border-b border-gray-200 px-2 py-1 text-xs font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
        {t('tools.markdown.outline')}
      </span>
      <div className="max-h-[240px] flex-1 overflow-auto p-1 lg:max-h-none">
        {items.length === 0 ? (
          <p className="px-2 py-1 text-xs text-gray-400 dark:text-gray-500">
            {t('tools.markdown.outlineEmpty')}
          </p>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.text || item.id}
              onClick={() => onSelect(item)}
              className="block w-full truncate rounded py-1 pr-1.5 text-left text-xs text-gray-600 transition-colors duration-150 hover:bg-gray-100 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-blue-400"
              style={{ paddingLeft: `${6 + (item.level - 1) * 10}px` }}
            >
              {item.text || '—'}
            </button>
          ))
        )}
      </div>
    </nav>
  );
}
