import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ensureLangLoaded, ensureToolStringsLoaded, localeResources } from '@/core/i18n/locales';
import { routedLangFromPath } from '@/core/i18n/routing';
import { detectBrowserLang, isLang, isSyncLang, normalizeLang, type Lang } from '@/core/i18n/types';

export type { Lang } from '@/core/i18n/types';
export {
  LANGS,
  LANG_META,
  SYNC_LANGS,
  collectBrowserLocales,
  detectBrowserLang,
  isLang,
  isSyncLang,
  mapBrowserLocale,
  normalizeLang,
} from '@/core/i18n/types';
export { ensureLangLoaded, hasToolStrings } from '@/core/i18n/locales';
export {
  DEFAULT_ROUTED_LANG,
  LANG_TAG,
  OG_LOCALE,
  ROUTED_LANGS,
  alternatesFor,
  hasOwnPath,
  isRoutedLang,
  langPrefix,
  routedLangFromPath,
  stripLangPrefix,
  withLangPrefix,
  type RoutedLang,
} from '@/core/i18n/routing';

const SETTINGS_KEY = 'syntools:settings.v1';

/**
 * In-site path with the basename stripped.
 *
 * A GitHub Pages build has `BASE_URL` = `/syntools/` while `window.location.pathname`
 * is `/syntools/zh/tools/x`. Without stripping it, the first segment parses as `syntools`
 * and the `/zh/` tree can never be recognized.
 */
function appPathname(): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  const path = window.location.pathname;
  if (!base) return path;
  if (!path.startsWith(base)) return path;
  return path.slice(base.length) || '/';
}

/** Which locale tree the current address belongs to (only to tell if /zh/ forces the language) */
function pathLang(): 'zh' | 'en' {
  return routedLangFromPath(appPathname());
}

/**
 * Boot language:
 * 1. `/zh/...` is always Simplified Chinese — the address is the declaration and skips detection;
 * 2. everything else follows "explicit choice → system/browser detection → English".
 *
 * Rule 2 deliberately does **not** force unprefixed paths to English: a Chinese visitor landing on `/`
 * from a bookmark or search still sees Chinese, as before, while English visitors already match.
 * Search engines get the prerendered English HTML (no localStorage, `navigator.language` =
 * en-US), so this rule cannot mislead them.
 */
export function resolveBootLang(): Lang {
  return pathLang() === 'zh' ? 'zh' : readStoredLang();
}

/**
 * Resolve the user's language:
 * 1. the user picked one explicitly in the dropdown (settings.langExplicit === true)
 * 2. otherwise detect system locale + browser language (system locale wins)
 * 3. otherwise English
 */
export function readStoredLang(): Lang {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { lang?: unknown; langExplicit?: unknown };
      // Only honor a language the user picked, so unrelated writes cannot freeze a misdetection
      if (parsed.langExplicit === true && typeof parsed.lang === 'string') {
        const normalized = normalizeLang(parsed.lang);
        if (normalized) return normalized;
        if (isLang(parsed.lang)) return parsed.lang;
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return detectBrowserLang();
}

const preferredLang = resolveBootLang();
/** Start lazy-loaded languages from en (the final fallback) so first paint never waits on a chunk */
const initialLng: Lang = isSyncLang(preferredLang) ? preferredLang : 'en';

void i18n.use(initReactI18next).init({
  resources: localeResources,
  lng: initialLng,
  fallbackLng: ['en', 'zh'],
  interpolation: { escapeValue: false },
  partialBundledLanguages: true,
});

/** Switch language: ensure resources are loaded, then changeLanguage */
export async function changeAppLanguage(lang: Lang): Promise<void> {
  await ensureLangLoaded(lang, (lng, ns, resources) => {
    i18n.addResourceBundle(lng, ns, resources, true, true);
  });
  await i18n.changeLanguage(lang);
}

/**
 * Load and register tool UI copy (`tools.*`).
 *
 * See `locales/index.ts` for why this is its own chunk: it is ~82% of a locale and only tool pages need it.
 * addResourceBundle details stay inside core; tool pages only care whether it is ready.
 */
export async function loadToolStrings(lang: Lang): Promise<void> {
  await ensureToolStringsLoaded(lang, (lng, ns, resources) => {
    i18n.addResourceBundle(lng, ns, resources, true, true);
  });
}

// If the preferred language needs lazy loading, switch to it asynchronously after boot
if (preferredLang !== initialLng) {
  void changeAppLanguage(preferredLang);
}

export { i18n };
