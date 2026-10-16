import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '@/app/layout/Header';
import { Sidebar } from '@/app/layout/Sidebar';
import { Icon } from '@/core/components/Icon';
import { SearchPalette } from '@/app/search/SearchPalette';

const SIDEBAR_COLLAPSED_KEY = 'syntools:sidebar-hidden.v1';

export function AppLayout() {
  const { t } = useTranslation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1',
  );

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
  };

  // 全局快捷键：⌘/Ctrl+K 或 /（非输入态）唤起搜索（技术设计 §7.3）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const editable =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === '/' && !editable) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <Header onSearch={() => setSearchOpen(true)} onMenu={() => setSidebarOpen(true)} />
      <div className="flex flex-1">
        {!sidebarCollapsed && <Sidebar onCollapse={toggleSidebarCollapsed} />}
        {sidebarCollapsed && (
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            aria-label={t('sidebar.expand')}
            title={t('sidebar.expand')}
            className="fixed left-0 top-14 z-20 m-2 rounded-md border border-gray-200 bg-white p-1.5 text-gray-400 shadow-sm hover:bg-gray-100 hover:text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <Icon name="panelLeftOpen" className="h-4 w-4" />
          </button>
        )}
        {sidebarOpen && <Sidebar mobile onClose={() => setSidebarOpen(false)} />}
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
