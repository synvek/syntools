import en from '@/core/i18n/locales/en';
import zh from '@/core/i18n/locales/zh';
import type { Lang, ShellResources, ToolStringsResources } from '@/core/i18n/types';
import { isLang, SYNC_LANGS } from '@/core/i18n/types';

/**
 * 语言资源被拆成两半，分开加载：
 *
 * | 部分 | 内容 | 加载时机 |
 * | ---- | ---- | -------- |
 * | `locales/<lang>` | 外壳（导航/首页/搜索/错误）+ `toolsMeta.*` | zh/en 同步进首屏，其余语言切换时加载 |
 * | `locales/<lang>.tools` | 各工具 UI 文案 `tools.*` | 进入工具页时与工具 chunk 并行加载 |
 *
 * 这样首屏不必为 152 个工具的 UI 文案买单（`tools.*` 占语言包约 82%），
 * 而工具页仍然「打开即可读」——文案与工具代码同时在路上，不引入串行往返。
 */

type ShellModule = { default: ShellResources };
type ToolsModule = { default: ToolStringsResources };

const loaders: Record<Lang, () => Promise<ShellModule>> = {
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

const toolsLoaders: Record<Lang, () => Promise<ToolsModule>> = {
  zh: () => import('@/core/i18n/locales/zh.tools'),
  en: () => import('@/core/i18n/locales/en.tools'),
  'zh-TW': () => import('@/core/i18n/locales/zh-TW.tools'),
  ja: () => import('@/core/i18n/locales/ja.tools'),
  fr: () => import('@/core/i18n/locales/fr.tools'),
  de: () => import('@/core/i18n/locales/de.tools'),
  it: () => import('@/core/i18n/locales/it.tools'),
  es: () => import('@/core/i18n/locales/es.tools'),
  pt: () => import('@/core/i18n/locales/pt.tools'),
};

/** 首屏同步资源（zh / en 的外壳）；其余语言按需动态 import */
export const localeResources: Partial<Record<Lang, { translation: ShellResources }>> &
  Record<(typeof SYNC_LANGS)[number], { translation: ShellResources }> = {
  zh: { translation: zh },
  en: { translation: en },
};

const loaded = new Set<Lang>([...SYNC_LANGS]);
const toolsLoaded = new Set<Lang>();

/** 按需加载语言包（外壳）并注册到 i18next（同源 chunk，零外发） */
export async function ensureLangLoaded(
  lang: Lang,
  addBundle: (lng: string, ns: string, resources: ShellResources) => void,
): Promise<void> {
  if (loaded.has(lang)) return;
  const mod = await loaders[lang]();
  addBundle(lang, 'translation', mod.default);
  loaded.add(lang);
}

/** 该语言的 `tools.*` 是否已注册（供工具页同步判断是否需要等待） */
export function hasToolStrings(lang: Lang): boolean {
  return toolsLoaded.has(lang);
}

/** 按需加载 `tools.*` 文案并注册到 i18next */
export async function ensureToolStringsLoaded(
  lang: Lang,
  addBundle: (lng: string, ns: string, resources: ToolStringsResources) => void,
): Promise<void> {
  if (toolsLoaded.has(lang)) return;
  const mod = await toolsLoaders[lang]();
  addBundle(lang, 'translation', mod.default);
  toolsLoaded.add(lang);
}

export { en, zh, isLang, SYNC_LANGS };
export type { Lang, ShellResources, ToolStringsResources };
