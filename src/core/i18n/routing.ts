/**
 * 语言与 URL 的对应关系。
 *
 * 背景：整站原先只有一条 URL 前缀，`<html lang>` 与 `title` / `description` 全部写死成
 * 简体中文，于是 Bing / Google 抓到的唯一信号是「这是中文站」——9 种界面语言对搜索
 * 引擎完全不存在。这里把「网址」变成语言的载体：
 *
 * | 路径 | 语言 | 说明 |
 * | ---- | ---- | ---- |
 * | `/`、`/tools/<id>/`、`/pricing/` … | en | 默认树，爬虫与首访看到的英文版 |
 * | `/zh/`、`/zh/tools/<id>/` … | zh | 中文树，带自己的 title / description |
 *
 * 只给 en 与 zh 建路径的理由：这两条覆盖绝大部分搜索流量，而其余 7 种语言继续
 * 靠客户端切换（`hreflang` 只能指向真实存在的 URL，造 1400 个页面换不来同等收益）。
 *
 * 这里全部是纯函数，不碰 `window`——`scripts/prerender.ts` 在 Node 里复用同一套规则，
 * 保证「运行时跳转前缀」与「预渲染落盘目录」永远不可能算出两个不同答案。
 */

import { LANGS, type Lang } from '@/core/i18n/types';

/** 拥有独立 URL 前缀的语言 */
export const ROUTED_LANGS = ['en', 'zh'] as const;

export type RoutedLang = (typeof ROUTED_LANGS)[number];

/** 无前缀路径所属的语言（也是 `x-default` 指向的版本） */
export const DEFAULT_ROUTED_LANG: RoutedLang = 'en';

/** `<html lang>` 与 `hreflang` 用的 BCP 47 标签 */
export const LANG_TAG: Record<Lang, string> = {
  zh: 'zh-CN',
  'zh-TW': 'zh-TW',
  en: 'en',
  ja: 'ja',
  fr: 'fr',
  de: 'de',
  it: 'it',
  es: 'es',
  pt: 'pt',
};

/** Open Graph 的 `og:locale` 格式（下划线 + 地区） */
export const OG_LOCALE: Record<Lang, string> = {
  zh: 'zh_CN',
  'zh-TW': 'zh_TW',
  en: 'en_US',
  ja: 'ja_JP',
  fr: 'fr_FR',
  de: 'de_DE',
  it: 'it_IT',
  es: 'es_ES',
  pt: 'pt_BR',
};

/** `og:locale:alternate` 只列有独立 URL 的语言 */
export const OG_LOCALE_ALTERNATE: Partial<Record<RoutedLang, string>> = {
  en: OG_LOCALE.en,
  zh: OG_LOCALE.zh,
};

export function isRoutedLang(value: string): value is RoutedLang {
  return (ROUTED_LANGS as readonly string[]).includes(value);
}

/** 语言 → URL 前缀（默认语言为空串，保证 `/` 唯一） */
export function langPrefix(lang: RoutedLang): string {
  return lang === DEFAULT_ROUTED_LANG ? '' : `/${lang}`;
}

/** 把路径切成 pathname 与 `?query#hash` 两段 */
function splitTail(path: string): [string, string] {
  const index = path.search(/[?#]/);
  return index === -1 ? [path, ''] : [path.slice(0, index), path.slice(index)];
}

/**
 * 从「已去掉 basename 的站内路径」解析语言。
 *
 * 只看第一段，且必须完全相等：`/zh-TW/...` 不会被误判成 `zh`（它没有独立路径，
 * 属于无前缀树里的客户端语言）。
 */
export function routedLangFromPath(pathname: string): RoutedLang {
  const [head] = splitTail(pathname);
  const first = head.split('/')[1] ?? '';
  return isRoutedLang(first) ? first : DEFAULT_ROUTED_LANG;
}

/** 去掉语言前缀，得到「与语言无关」的路径；`/zh` → `/`，`/zh/tools/x` → `/tools/x` */
export function stripLangPrefix(path: string): string {
  const [head, tail] = splitTail(path);
  const first = head.split('/')[1] ?? '';
  if (!isRoutedLang(first)) return path;
  const rest = head.slice(first.length + 1) || '/';
  return rest + tail;
}

/** 给站内绝对路径加语言前缀；外链、协议相对地址、相对路径原样返回 */
export function withLangPrefix(path: string, lang: RoutedLang): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  return langPrefix(lang) + stripLangPrefix(path);
}

/** 语言是否拥有独立 URL（决定切换语言时要不要改地址栏） */
export function hasOwnPath(lang: Lang): lang is RoutedLang {
  return isRoutedLang(lang);
}

/** 全部语言 → 该语言下某条路径的完整 URL 路径（供 hreflang / sitemap 使用） */
export function alternatesFor(path: string): { lang: RoutedLang; href: string }[] {
  return ROUTED_LANGS.map((lang) => ({ lang, href: withLangPrefix(path, lang) }));
}

export { LANGS };
