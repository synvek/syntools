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
 * 站内路径（去掉 basename）。
 *
 * GitHub Pages 构建的 `BASE_URL` 是 `/syntools/`，而 `window.location.pathname`
 * 是 `/syntools/zh/tools/x`。不去掉前缀的话第一段会解析成 `syntools`，
 * `/zh/` 这棵树就永远认不出来。
 */
function appPathname(): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  const path = window.location.pathname;
  if (!base) return path;
  if (!path.startsWith(base)) return path;
  return path.slice(base.length) || '/';
}

/** 当前地址属于哪棵语言树（只用于「是否被 /zh/ 强制」这一件事） */
function pathLang(): 'zh' | 'en' {
  return routedLangFromPath(appPathname());
}

/**
 * 启动语言：
 * 1. `/zh/...` 一律简体中文——地址本身就是声明，不参与任何检测；
 * 2. 其余地址按「显式选择 → 系统/浏览器检测 → English」。
 *
 * 第 2 条刻意**不**把无前缀路径强制成英文：中文访客从书签或搜索结果直接落到 `/`，
 * 仍然看到中文，与改动前一致；而英文访客的路径与内容本来就一致。
 * 搜索引擎看到的是预渲染的英文 HTML（无 localStorage、`navigator.language` 为
 * en-US），因此不会被这条规则带偏。
 */
export function resolveBootLang(): Lang {
  return pathLang() === 'zh' ? 'zh' : readStoredLang();
}

/**
 * 解析用户语言：
 * 1. 用户曾在下拉框中显式选择过（settings.langExplicit === true）
 * 2. 否则检测系统区域 + 浏览器语言（系统区域优先）
 * 3. 仍无匹配则 English
 */
export function readStoredLang(): Lang {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { lang?: unknown; langExplicit?: unknown };
      // 仅采纳「用户手动选过」的语言，避免主题切换等把误检结果写死
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
/** 懒加载语言启动时先用 en（最终兜底），避免首屏等待 chunk */
const initialLng: Lang = isSyncLang(preferredLang) ? preferredLang : 'en';

void i18n.use(initReactI18next).init({
  resources: localeResources,
  lng: initialLng,
  fallbackLng: ['en', 'zh'],
  interpolation: { escapeValue: false },
  partialBundledLanguages: true,
});

/** 切换语言：先确保资源已加载，再 changeLanguage */
export async function changeAppLanguage(lang: Lang): Promise<void> {
  await ensureLangLoaded(lang, (lng, ns, resources) => {
    i18n.addResourceBundle(lng, ns, resources, true, true);
  });
  await i18n.changeLanguage(lang);
}

/**
 * 加载并注册工具 UI 文案（`tools.*`）。
 *
 * 单独成 chunk 的理由见 `locales/index.ts`：它占语言包约 82%，只有工具页需要。
 * 这里把 addResourceBundle 的细节收在 core 内，工具页只关心「是否就绪」。
 */
export async function loadToolStrings(lang: Lang): Promise<void> {
  await ensureToolStringsLoaded(lang, (lng, ns, resources) => {
    i18n.addResourceBundle(lng, ns, resources, true, true);
  });
}

// 若偏好语言需懒加载，启动后再异步切过去
if (preferredLang !== initialLng) {
  void changeAppLanguage(preferredLang);
}

export { i18n };
