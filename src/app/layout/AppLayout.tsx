import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '@/app/layout/Header';
import { Sidebar } from '@/app/layout/Sidebar';
import { SearchPalette } from '@/app/search/SearchPalette';

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        <Sidebar />
        {sidebarOpen && <Sidebar mobile onClose={() => setSidebarOpen(false)} />}
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
