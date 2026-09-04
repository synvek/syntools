import en from '@/core/i18n/locales/en';
import zh from '@/core/i18n/locales/zh';
import type { Lang, TranslationResources } from '@/core/i18n/types';
import { isLang } from '@/core/i18n/types';

/**
 * 同步打包进首屏的语言（默认 zh；en 使用频率高一并内联，避免首切闪烁）。
 * 其余语言按需动态 import，避免撑爆首屏体积预算。
 */
export const SYNC_LANGS = ['zh', 'en'] as const satisfies readonly Lang[];

type LocaleModule = { default: TranslationResources };

const loaders: Record<Lang, () => Promise<LocaleModule>> = {
  zh: () => import('@/core/i18n/locales/zh'),
  en: () => import('@/core/i18n/locales/en'),
  'zh-TW': () => import('@/core/i18n/locales/zh-TW'),
  ja: () => import('@/core/i18n/locales/ja'),
  fr: () => import('@/core/i18n/locales/fr'),
  de: () => import('@/core/i18n/locales/de'),
  it: () => import('@/core/i18n/locales/it'),
  es: () => import('@/core/i18n/locales/es'),
  pt: () => import('@/core/i18n/locales/pt'),
};

/** 首屏同步资源 */
export const localeResources: Partial<Record<Lang, { translation: TranslationResources }>> &
  Record<(typeof SYNC_LANGS)[number], { translation: TranslationResources }> = {
  zh: { translation: zh },
  en: { translation: en },
};

const loaded = new Set<Lang>(SYNC_LANGS);

/** 按需加载语言包并注册到 i18next（同源 chunk，零外发） */
export async function ensureLangLoaded(
  lang: Lang,
  addBundle: (lng: string, ns: string, resources: TranslationResources) => void,
): Promise<void> {
  if (loaded.has(lang)) return;
  const mod = await loaders[lang]();
  addBundle(lang, 'translation', mod.default);
  loaded.add(lang);
}

export { en, zh, isLang };
export type { Lang, TranslationResources };
