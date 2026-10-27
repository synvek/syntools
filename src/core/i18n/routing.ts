/**
 * Language-to-URL mapping.
 *
 * Background: the site once had a single URL prefix, with `<html lang>`, `title` and `description` hard-coded to
 * Simplified Chinese, so the only signal Bing / Google got was "this is a Chinese site" — the 9 UI
 * languages were invisible to search. Here the URL itself carries the language:
 *
 * | Path | Language | Notes |
 * | ---- | ---- | ---- |
 * | `/`, `/tools/<id>/`, `/pricing/` … | en | default tree, the English version crawlers and first visits see |
 * | `/zh/`, `/zh/tools/<id>/` … | zh | Chinese tree with its own title / description |
 *
 * Only en and zh get paths: they cover most search traffic, while the other 7 languages keep
 * switching client-side (`hreflang` must point at real URLs; 1400 pages would not pay for themselves).
 *
 * Everything here is pure and never touches `window`: `scripts/prerender.ts` reuses these rules in Node,
 * so runtime redirect prefixes and prerender output dirs can never disagree.
 */

import { LANGS, type Lang } from '@/core/i18n/types';

/** Languages with their own URL prefix */
export const ROUTED_LANGS = ['en', 'zh'] as const;

export type RoutedLang = (typeof ROUTED_LANGS)[number];

/** Language of unprefixed paths (also what `x-default` points to) */
export const DEFAULT_ROUTED_LANG: RoutedLang = 'en';

/** BCP 47 tag used by `<html lang>` and `hreflang` */
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

/** Open Graph `og:locale` format (underscore plus region) */
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

/** `og:locale:alternate` lists only languages with their own URL */
export const OG_LOCALE_ALTERNATE: Partial<Record<RoutedLang, string>> = {
  en: OG_LOCALE.en,
  zh: OG_LOCALE.zh,
};

export function isRoutedLang(value: string): value is RoutedLang {
  return (ROUTED_LANGS as readonly string[]).includes(value);
}

/** Language → URL prefix (empty for the default language, keeping `/` unique) */
export function langPrefix(lang: RoutedLang): string {
  return lang === DEFAULT_ROUTED_LANG ? '' : `/${lang}`;
}

/** Split a path into pathname and `?query#hash` */
function splitTail(path: string): [string, string] {
  const index = path.search(/[?#]/);
  return index === -1 ? [path, ''] : [path.slice(0, index), path.slice(index)];
}

/**
 * Parse the language from an in-site path with the basename already stripped.
 *
 * Only the first segment counts and must match exactly: `/zh-TW/...` is not read as `zh` (it has no own path
 * and is a client-side language inside the unprefixed tree).
 */
export function routedLangFromPath(pathname: string): RoutedLang {
  const [head] = splitTail(pathname);
  const first = head.split('/')[1] ?? '';
  return isRoutedLang(first) ? first : DEFAULT_ROUTED_LANG;
}

/** Strip the locale prefix for a language-agnostic path; `/zh` → `/`, `/zh/tools/x` → `/tools/x` */
export function stripLangPrefix(path: string): string {
  const [head, tail] = splitTail(path);
  const first = head.split('/')[1] ?? '';
  if (!isRoutedLang(first)) return path;
  const rest = head.slice(first.length + 1) || '/';
  return rest + tail;
}

/** Prefix an internal absolute path; external, protocol-relative and relative URLs come back unchanged */
export function withLangPrefix(path: string, lang: RoutedLang): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  return langPrefix(lang) + stripLangPrefix(path);
}

/** Whether a language has its own URL (decides if switching rewrites the address bar) */
export function hasOwnPath(lang: Lang): lang is RoutedLang {
  return isRoutedLang(lang);
}

/** Every language → the full path for a route in that language (for hreflang / sitemap) */
export function alternatesFor(path: string): { lang: RoutedLang; href: string }[] {
  return ROUTED_LANGS.map((lang) => ({ lang, href: withLangPrefix(path, lang) }));
}

export { LANGS };
