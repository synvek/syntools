import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tools, toolMap } from '@/core/registry';
import { categories } from '@/core/registry/categories';
import { Icon } from '@/core/components/Icon';
import { getToolMeta } from '@/core/i18n/helpers';
import type { CategoryId } from '@/core/types';

interface SidebarProps {
  /** 移动端抽屉模式 */
  mobile?: boolean;
  onClose?: () => void;
}

const COLLAPSED_KEY = 'syntools:sidebar-collapsed.v1';

function readCollapsed(): Set<CategoryId> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is CategoryId => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

function writeCollapsed(ids: Set<CategoryId>) {
  localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...ids]));
}

function toolIdFromPath(pathname: string): string | undefined {
  const m = pathname.match(/^\/tools\/([^/]+)/);
  return m?.[1];
}

/** 侧边栏：注册表按分类分组 + weight 排序 + 本地筛选 + 分类折叠 */
export function Sidebar({ mobile = false, onClose }: SidebarProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<CategoryId>>(readCollapsed);
  /** 当前展开「分类操作」弹窗的分类 id（同时只允许一个） */
  const [menuFor, setMenuFor] = useState<CategoryId | null>(null);
  const query = filter.trim().toLowerCase();
  const filtering = query.length > 0;

  const activeCategory = (() => {
    const toolId = toolIdFromPath(pathname);
    return toolId ? toolMap.get(toolId)?.category : undefined;
  })();

  // 当前工具所在分类若被折叠，自动展开，避免高亮项不可见
  useEffect(() => {
    if (!activeCategory) return;
    setCollapsed((prev) => {
      if (!prev.has(activeCategory)) return prev;
      const next = new Set(prev);
      next.delete(activeCategory);
      writeCollapsed(next);
      return next;
    });
  }, [activeCategory]);

  const grouped = useMemo(() => {
    return categories
      .map((category) => ({
        category,
        items: tools
          .filter((tool) => tool.category === category.id)
          .filter((tool) => {
            if (!query) return true;
            const { name, description } = getToolMeta(tool);
            const hay = [tool.id, name, description, ...tool.keywords].join(' ').toLowerCase();
            return hay.includes(query);
          })
          .sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0)),
      }))
      .filter((g) => g.items.length > 0);
  }, [query]);

  const toggleCategory = (id: CategoryId) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeCollapsed(next);
      return next;
    });
  };

  const applyCollapsed = (ids: Set<CategoryId>) => {
    writeCollapsed(ids);
    setCollapsed(ids);
    setMenuFor(null);
  };

  const expandAll = () => applyCollapsed(new Set());

  const collapseAll = () => applyCollapsed(new Set(categories.map((c) => c.id)));

  // 点击弹窗外部或按 Esc 时关闭
  useEffect(() => {
    if (!menuFor) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-sidebar-category-menu]')) return;
      setMenuFor(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuFor(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuFor]);

  const content = (
    <nav
      aria-label={t('sidebar.nav')}
      className="flex h-full w-[220px] flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
    >
      <div className="border-b border-gray-200 p-3 dark:border-gray-800">
        <label className="sr-only" htmlFor="sidebar-filter">
          {t('sidebar.filter')}
        </label>
        <input
          id="sidebar-filter"
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('sidebar.filterPlaceholder')}
          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:placeholder:text-gray-500"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {grouped.length === 0 ? (
          <p className="px-2 text-xs text-gray-400">{t('sidebar.filterEmpty')}</p>
        ) : (
          grouped.map(({ category, items }) => {
            const isCollapsed = !filtering && collapsed.has(category.id);
            const label = t(`categories.${category.id}`);
            const menuOpen = menuFor === category.id;
            return (
              <div key={category.id} className="mb-2">
                <div className="mb-0.5 flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    aria-expanded={!isCollapsed}
                    aria-controls={`sidebar-cat-${category.id}`}
                    className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-2 py-1 text-left text-xs font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  >
                    <Icon
                      name="chevron"
                      className={`h-3 w-3 shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                    />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    <span className="tabular-nums text-[10px] opacity-70">{items.length}</span>
                  </button>
                  <div className="relative shrink-0" data-sidebar-category-menu>
                    <button
                      type="button"
                      onClick={() => setMenuFor(menuOpen ? null : category.id)}
                      aria-label={t('sidebar.categoryActions')}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                    >
                      <Icon name="more" className="h-3.5 w-3.5" />
                    </button>
                    {menuOpen && (
                      <div
                        role="menu"
                        aria-label={t('sidebar.categoryActions')}
                        className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={expandAll}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          <Icon name="chevron" className="h-3 w-3 shrink-0" />
                          <span className="min-w-0 flex-1 truncate">{t('sidebar.expandAll')}</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={collapseAll}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          <Icon name="chevron" className="h-3 w-3 shrink-0 -rotate-90" />
                          <span className="min-w-0 flex-1 truncate">
                            {t('sidebar.collapseAll')}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <ul
                  id={`sidebar-cat-${category.id}`}
                  hidden={isCollapsed}
                  className={isCollapsed ? 'hidden' : undefined}
                >
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
            );
          })
        )}
      </div>
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
