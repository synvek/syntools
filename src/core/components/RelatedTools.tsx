import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ToolMeta } from '@/core/types';
import { Icon } from '@/core/components/Icon';
import { getToolMeta } from '@/core/i18n/helpers';
import { resolveRelatedTools } from '@/core/lib/relatedTools';

export function RelatedTools({ tool, limit = 6 }: { tool: ToolMeta; limit?: number }) {
  const { t } = useTranslation();
  const related = resolveRelatedTools(tool, limit);
  if (related.length === 0) return null;

  return (
    <section className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-800" aria-label={t('tool.related')}>
      <h2 className="mb-3 text-sm font-semibold text-gray-500 dark:text-gray-400">{t('tool.related')}</h2>
      <ul className="flex flex-wrap gap-2">
        {related.map((item) => {
          const { name } = getToolMeta(item);
          return (
            <li key={item.id}>
              <Link
                to={`/tools/${item.id}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 hover:border-blue-300 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-blue-700 dark:hover:text-blue-300"
              >
                <Icon name={item.icon} className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                {name}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
