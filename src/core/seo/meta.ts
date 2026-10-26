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
 * 让 `<html lang>`、`<meta name="description">`、`og:*`、`canonical` 跟随当前语言。
 *
 * 为什么需要这个：
 * 站点的 head 是构建期预渲染出来的，写死成一种语言。用户在下拉框切到英文后，
 * 原先只有 `document.title` 被几个页面各自改了一下，`lang` 仍是 `zh-CN`、
 * 描述仍是中文——屏幕阅读器按中文朗读英文界面，CJK 字体 fallback 也跟着错，
 * 而搜索引擎若执行 JS，会读到一套自相矛盾的信号。
 *
 * 取值顺序：
 * 1. 工具页 → `toolsMeta.<id>.description`（9 种语言都已有的人工文案）；
 * 2. 静态页 → `core/seo/copy.ts` 的同一张表（与预渲染完全同源）；
 * 3. 其余（404 等）→ 保持文档里已有的值，不做无谓改写。
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

/** hreflang 链接按语言区分，不能用 `upsertLink`（它会命中第一条 alternate） */
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

/** 站内绝对地址（含部署前缀），用于 canonical / og:url */
function absoluteUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return new URL(path.replace(/^\//, ''), new URL(base, window.location.origin)).href;
}

/** 解析当前路径应使用的标题与描述；返回 null 表示不认识这条路径 */
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
    // 缺这条工具的该语种文案时 i18next 回落到 en/zh；两者都没有则保持原样
    if (!name || !desc) return null;
    // 后缀只有 en / zh 两份译文。其余语言（含繁体）不拼，否则会出现
    // 「日本語の説明 + Processed entirely on the client」这种半句混语。
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
    // 1) 文档语言：无障碍与字体选择的正解，也是浏览器翻译提示的依据
    document.documentElement.lang = LANG_TAG[lang];

    // 2) 页面级标题与描述
    const seo = resolvePageSeo(pathname, lang, t);
    if (seo) {
      document.title = seo.title;
      upsertMeta('name', 'description', seo.description);
      upsertMeta('property', 'og:description', seo.description);
      upsertMeta('name', 'twitter:description', seo.description);
      upsertMeta('property', 'og:title', seo.title);
      upsertMeta('name', 'twitter:title', seo.title);
    }

    // 3) 语言声明：og:locale 必须与界面语言一致，否则分享卡片会标注错语言
    upsertMeta('property', 'og:locale', OG_LOCALE[lang]);
    // 另一条语言树作为 alternate：分享卡片仍能给出「另一种语言版本」的提示
    upsertMeta(
      'property',
      'og:locale:alternate',
      lang === 'zh' || lang === 'zh-TW' ? OG_LOCALE.en : OG_LOCALE.zh,
    );

    // 4) canonical 指向**当前地址所属的那棵树**，与界面语言无关：
    //    `/pricing` 就是英文页，即便访客把界面切成日语，这条 URL 在搜索引擎眼里仍是英文版。
    //    用界面语言算会把整棵树都搬到 `/zh/` 去，等于自己制造重复内容。
    const bare = stripLangPrefix(pathname);
    const canonicalPath = withLangPrefix(bare, routedLangFromPath(pathname));
    upsertLink('canonical', absoluteUrl(canonicalPath));
    upsertMeta('property', 'og:url', absoluteUrl(canonicalPath));

    // 5) hreflang 跟着当前页面走。
    //    预渲染时每条页面都写了自己的 alternates，但客户端路由跳转不会重写 head，
    //    于是从 `/zh/` 点进工具页后，head 里指向的还是首页 —— 这正是我们要修的那类
    //    「head 与地址不一致」，所以在这里补上。
    for (const alt of ROUTED_LANGS) {
      upsertAlternate(LANG_TAG[alt], absoluteUrl(withLangPrefix(bare, alt)));
    }
    upsertAlternate('x-default', absoluteUrl(withLangPrefix(bare, DEFAULT_ROUTED_LANG)));
  }, [pathname, lang, t]);
}
