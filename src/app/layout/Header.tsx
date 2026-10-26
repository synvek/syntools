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
   * 当前语言以 i18next 为准，而不是 store 里那份。
   * `/zh/` 这棵树会强制中文，此时 store 里可能还存着「上次选的英文」——
   * 下拉框必须以真正在生效的语言显示，否则会显示成英文而界面是中文。
   */
  const lang = normalizeLang(i18n.resolvedLanguage ?? 'en') ?? 'en';
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  /**
   * 不做「按浏览器语言自动跳转」。
   *
   * `/` 是英文树（爬虫看到的那一版），而 `resolveBootLang()` 仍然允许中文浏览器在
   * 无前缀路径上看到中文界面——所以中文访客并不会被英文界面卡住，没有必要用
   * `navigator.language` 做一次客户端 redirect。那种 redirect 对爬虫接近「隐藏内容」，
   * 是 Google 明确警告过的 cloaking 模式，收益远小于风险。
   *
   * 中文树的可达性由三处保证：下拉框切到中文时跳到 `/zh/…`、搜索结果经 `hreflang`
   * 直接落到 `/zh/…`、页面里的语言切换会保留当前路径。
   */

  /**
   * 切换语言时同步地址：
   * - en / zh 有独立 URL，跳到对应那棵树；
   * - 其余 7 种语言没有 URL，若当前在 `/zh/` 下要退回无前缀树，
   *   否则刷新时路径会把语言按回中文。
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
