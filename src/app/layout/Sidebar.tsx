import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tools } from '@/core/registry';
import { categories } from '@/core/registry/categories';
import { Icon } from '@/core/components/Icon';
import { getToolMeta } from '@/core/i18n/helpers';

interface SidebarProps {
  /** 移动端抽屉模式 */
  mobile?: boolean;
  onClose?: () => void;
}

/** 侧边栏：注册表按分类分组 + weight 排序（技术设计 §5.3） */
export function Sidebar({ mobile = false, onClose }: SidebarProps) {
  const { t } = useTranslation();
  const grouped = categories
    .map((category) => ({
      category,
      items: tools
        .filter((t) => t.category === category.id)
        .sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0)),
    }))
    .filter((g) => g.items.length > 0);

  const content = (
    <nav
      aria-label={t('sidebar.nav')}
      className="h-full w-[220px] overflow-y-auto border-r border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950"
    >
      {grouped.map(({ category, items }) => (
        <div key={category.id} className="mb-4">
          <p className="mb-1 px-2 text-xs font-medium text-gray-400 dark:text-gray-500">
            {t(`categories.${category.id}`)}
          </p>
          <ul>
            {items.map((tool) => {
              const { name } = getToolMeta(tool);
              return (
                <li key={tool.id}>
                  <NavLink
                    to={`/tools/${tool.id}`}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                        isActive
                          ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                      }`
                    }
                  >
                    <Icon name={tool.icon} className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="truncate">{name}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  if (mobile) {
    return (
      <div className="fixed inset-0 z-40 lg:hidden">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
        <div className="absolute inset-y-0 left-0 flex">
          {content}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('sidebar.closeMenu')}
            className="m-3 self-start rounded-md bg-white p-1.5 shadow dark:bg-gray-900"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-14 h-[calc(100vh-3.5rem)]">{content}</div>
    </aside>
  );
}
