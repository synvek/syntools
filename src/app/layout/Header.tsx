import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { Link } from '@/core/components/LocaleLink';
import {
  LANGS,
  LANG_META,
  hasOwnPath,
  normalizeLang,
  stripLangPrefix,
  withLangPrefix,
  type Lang,
  type RoutedLang,
} from '@/core/i18n';
import { useSettingsStore } from '@/stores/settings';

interface HeaderProps {
  onSearch: () => void;
  onMenu: () => void;
}

export function Header({ onSearch, onMenu }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const theme = useSettingsStore((s) => s.theme);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);
  const setLang = useSettingsStore((s) => s.setLang);
  /**
   * The language comes from i18next, not the copy in the store.
   * The `/zh/` tree forces Chinese while the store may still hold "English, picked last time" —
   * so the dropdown must show the language actually in effect, not English over a Chinese UI.
   */
  const lang = normalizeLang(i18n.resolvedLanguage ?? 'en') ?? 'en';
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  /**
   * No "redirect by browser language".
   *
   * `/` is the English tree (what crawlers see), yet `resolveBootLang()` still lets Chinese browsers
   * see a Chinese UI on unprefixed paths — so Chinese visitors are never stuck with English and there is no need for
   * a client-side `navigator.language` redirect. For crawlers that is close to "hidden content",
   * a cloaking pattern Google explicitly warns about, with far more risk than reward.
   *
   * The Chinese tree stays reachable three ways: the dropdown jumps to `/zh/…`, search results arrive via `hreflang`
   * straight at `/zh/…`, and in-page language switches keep the current path.
   */

  /**
   * Keep the address in sync when switching:
   * - en / zh have their own URLs, so jump to the matching tree;
   * - the other 7 have no URL, so leave `/zh/` for the unprefixed tree,
   *   otherwise a refresh forces the language back to Chinese.
   */
  const onLangChange = (next: Lang) => {
    void setLang(next);
    const bare = stripLangPrefix(pathname);
    const target = hasOwnPath(next) ? withLangPrefix(bare, next as RoutedLang) : bare;
    if (target !== pathname) navigate(target);
  };

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
        <img
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt=""
          width={20}
          height={20}
          className="h-5 w-5"
        />
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
          title={t('header.searchAria')}
          className="rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 sm:hidden"
        >
          <Icon name="search" />
        </button>
        <label className="sr-only" htmlFor="header-lang">
          {t('header.langAria')}
        </label>
        <select
          id="header-lang"
          value={lang}
          aria-label={t('header.langAria')}
          title={t('header.langAria')}
          onChange={(e) => onLangChange(e.target.value as Lang)}
          className="max-w-[7.5rem] rounded-md border border-transparent bg-transparent py-1.5 pl-1.5 pr-1 text-xs font-medium hover:bg-gray-100 focus:border-gray-300 focus:outline-none dark:hover:bg-gray-800 dark:focus:border-gray-600"
        >
          {LANGS.map((code) => (
            <option key={code} value={code}>
              {LANG_META[code].nativeLabel}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={t('header.themeAria')}
          title={t('header.themeAria')}
          className="rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Icon name={isDark ? 'sun' : 'moon'} />
        </button>
        <Link
          to="/download"
          aria-label={t('header.downloadAria')}
          title={t('header.downloadAria')}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Icon name="download" className="h-4 w-4" />
          <span className="hidden sm:inline">{t('header.downloadLabel')}</span>
        </Link>
        <a
          href="https://github.com/synvek/syntools"
          target="_blank"
          rel="noreferrer"
          aria-label={t('header.sourceAria')}
          title={t('header.sourceAria')}
          className="rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Icon name="github" />
        </a>
      </div>
    </header>
  );
}
