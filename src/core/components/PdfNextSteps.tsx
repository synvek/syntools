import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toolMap } from '@/core/registry';
import { Icon } from '@/core/components/Icon';
import { getToolMeta } from '@/core/i18n/helpers';

/** 结果完成后的「下一步」chips（U5） */
export function PdfNextSteps({ toolIds }: { toolIds: string[] }) {
  const { t } = useTranslation();
  const items = toolIds.map((id) => toolMap.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/50">
      <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">{t('tool.nextSteps')}</p>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => {
          const { name } = getToolMeta(item);
          return (
            <li key={item.id}>
              <Link
                to={`/tools/${item.id}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-sm text-blue-700 ring-1 ring-gray-200 hover:ring-blue-300 dark:bg-gray-950 dark:text-blue-300 dark:ring-gray-700"
              >
                <Icon name={item.icon} className="h-3.5 w-3.5" />
                {name}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
