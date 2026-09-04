import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { useSettingsStore } from '@/stores/settings';

interface HeaderProps {
  onSearch: () => void;
  onMenu: () => void;
}

export function Header({ onSearch, onMenu }: HeaderProps) {
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);
  const lang = useSettingsStore((s) => s.lang);
  const setLang = useSettingsStore((s) => s.setLang);
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-950">
      <button
        type="button"
        onClick={onMenu}
        aria-label={t('header.openMenu')}
        className="rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden"
      >
        <Icon name="menu" />
      </button>

      <Link to="/" className="flex items-center gap-2 text-lg font-bold">
        <img src="/logo.svg" alt="" width={20} height={20} className="h-5 w-5" />
        SynTools
      </Link>

      <button
        type="button"
        onClick={onSearch}
        className="ml-4 hidden max-w-md flex-1 items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-400 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600 sm:flex"
      >
        <Icon name="search" className="h-4 w-4" />
        {t('header.searchPlaceholder')}
        <kbd className="ml-auto rounded border border-gray-300 px-1.5 text-xs dark:border-gray-600">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onSearch}
          aria-label={t('header.searchAria')}
          className="rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 sm:hidden"
        >
          <Icon name="search" />
        </button>
        <button
          type="button"
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          aria-label={t('header.langAria')}
          className="rounded-md px-2 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {lang === 'zh' ? 'EN' : '中'}
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={t('header.themeAria')}
          className="rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Icon name={isDark ? 'sun' : 'moon'} />
        </button>
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          aria-label={t('header.sourceAria')}
          className="rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Icon name="globe" />
        </a>
      </div>
    </header>
  );
}
