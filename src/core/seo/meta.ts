import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import {
  DEFAULT_ROUTED_LANG,
  LANG_TAG,
  OG_LOCALE,
  ROUTED_LANGS,
  normalizeLang,
  routedLangFromPath,
  stripLangPrefix,
  withLangPrefix,
  type Lang,
} from '@/core/i18n';
import { TOOL_DESCRIPTION_SUFFIX, pageTitle, seoLangOf, staticPageSeo } from '@/core/seo/copy';

/**
 * Keep `<html lang>`, `<meta name="description">`, `og:*` and `canonical` in sync with the active language.
 *
 * Why this exists:
 * the head is prerendered at build time in one hard-coded language. Once a user switches to English,
 * previously only `document.title` changed per page while `lang` stayed `zh-CN`, the description
 * stayed Chinese — screen readers read English UI in Chinese, CJK font fallback went wrong,
 * and a JS-executing crawler saw contradictory signals.
 *
 * Lookup order:
 * 1. tool pages → `toolsMeta.<id>.description` (hand-written for all 9 languages);
 * 2. static pages → the same table in `core/seo/copy.ts` (identical to prerendering);
 * 3. everything else (404s) → keep what the document already has, with no needless rewriting.
 */

const TOOL_PATH = /^\/tools\/([^/]+)/;

function upsertMeta(attr: 'name' | 'property', key: string, value: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  if (el.getAttribute('content') !== value) el.setAttribute('content', value);
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  if (el.getAttribute('href') !== href) el.setAttribute('href', href);
}

/** hreflang links differ per language, so `upsertLink` cannot be used (it hits the first alternate) */
function upsertAlternate(hreflang: string, href: string): void {
  const selector = `link[rel="alternate"][hreflang="${hreflang}"]`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'alternate');
    el.setAttribute('hreflang', hreflang);
    document.head.appendChild(el);
  }
  if (el.getAttribute('href') !== href) el.setAttribute('href', href);
}

/** Absolute in-site URL (including the deploy prefix) for canonical / og:url */
function absoluteUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return new URL(path.replace(/^\//, ''), new URL(base, window.location.origin)).href;
}

/** Resolve title and description for the current path; null means the path is unknown */
export function resolvePageSeo(
  pathname: string,
  lang: Lang,
  t: (key: string) => string,
): { title: string; description: string } | null {
  const bare = stripLangPrefix(pathname);
  const seoLang = seoLangOf(lang);

  const toolId = TOOL_PATH.exec(bare)?.[1];
  if (toolId) {
    const name = t(`toolsMeta.${toolId}.name`);
    const desc = t(`toolsMeta.${toolId}.description`);
    // Missing copy for this tool and language falls back to en/zh via i18next; otherwise keep as-is
    if (!name || !desc) return null;
    // The suffix exists in en / zh only. Other languages (including Traditional) skip it, otherwise you get
    // half-language mashups like "日本語の説明 + Processed entirely on the client".
    const suffix = lang === 'en' || lang === 'zh' ? ` ${TOOL_DESCRIPTION_SUFFIX[lang]}` : '';
    return {
      title: pageTitle(name, seoLang),
      description: `${desc}${suffix}`,
    };
  }

  const seo = staticPageSeo(bare, seoLang);
  if (!seo) return null;
  return { title: pageTitle(seo.title, seoLang), description: seo.description };
}

export function useDocumentMeta(): void {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const lang = normalizeLang(i18n.resolvedLanguage ?? 'en') ?? 'en';

  useEffect(() => {
    // 1) Document language: drives a11y, font choice and the browser translate prompt
    document.documentElement.lang = LANG_TAG[lang];

    // 2) Page-level title and description
    const seo = resolvePageSeo(pathname, lang, t);
    if (seo) {
      document.title = seo.title;
      upsertMeta('name', 'description', seo.description);
      upsertMeta('property', 'og:description', seo.description);
      upsertMeta('name', 'twitter:description', seo.description);
      upsertMeta('property', 'og:title', seo.title);
      upsertMeta('name', 'twitter:title', seo.title);
    }

    // 3) Locale declaration: og:locale must match the UI language or share cards label the wrong one
    upsertMeta('property', 'og:locale', OG_LOCALE[lang]);
    // The other tree as an alternate: share cards can still offer the other language version
    upsertMeta(
      'property',
      'og:locale:alternate',
      lang === 'zh' || lang === 'zh-TW' ? OG_LOCALE.en : OG_LOCALE.zh,
    );

    // 4) canonical points at **the tree of the current address**, not the UI language:
    //    `/pricing` is the English page; even with a Japanese UI, search engines still see English.
    //    Deriving it from the UI language would move the whole tree to `/zh/`, creating duplicate content.
    const bare = stripLangPrefix(pathname);
    const canonicalPath = withLangPrefix(bare, routedLangFromPath(pathname));
    upsertLink('canonical', absoluteUrl(canonicalPath));
    upsertMeta('property', 'og:url', absoluteUrl(canonicalPath));

    // 5) hreflang follows the current page.
    //    Prerendering writes alternates per page, but client-side navigation never rewrites the head,
    //    so after clicking from `/zh/` into a tool page the head still points at the home page — exactly the
    //    "head does not match the address" bug this fixes.
    for (const alt of ROUTED_LANGS) {
      upsertAlternate(LANG_TAG[alt], absoluteUrl(withLangPrefix(bare, alt)));
    }
    upsertAlternate('x-default', absoluteUrl(withLangPrefix(bare, DEFAULT_ROUTED_LANG)));
  }, [pathname, lang, t]);
}
