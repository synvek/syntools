import type { Lang } from '@/core/i18n/types';

/**
 * **Runtime** copy for search engines: site title, description, one-liners for static pages.
 *
 * Why this is split from `sections.ts`:
 * `scripts/prerender.ts` needs readable body copy for no-JS environments (section headings plus items),
 * but `core/seo/meta.ts` in the browser only needs title and description. In one module,
 * every visitor would download crawler-only body text — 195 KB of first-load budget is too much to spend.
 *
 * Both tables cover en and zh only: those two have their own URLs, the other 7 get no SEO paths.
 */

/** Languages with SEO copy (one-to-one with `ROUTED_LANGS`) */
export type SeoLang = 'en' | 'zh';

export const SEO_LANGS: readonly SeoLang[] = ['en', 'zh'];

/** Site name: reused for the `<title>` suffix, og:site_name and the JSON-LD publisher */
export const SITE_NAME: Record<SeoLang, string> = {
  en: 'SynTools',
  zh: 'SynTools',
};

/** Title separator: " - " with spaces in both languages, matching existing pages */
const TITLE_SEP = ' - ';

/**
 * Site-level `<title>` (home page and fallback).
 *
 * Deliberately just the name plus one positioning line: titles get cut near 60 characters,
 * and keyword stuffing cuts the brand name too.
 */
export const SITE_TITLE: Record<SeoLang, string> = {
  en: `SynTools${TITLE_SEP}Online Toolkit`,
  zh: `SynTools${TITLE_SEP}在线工具集`,
};

/** Site-level one-line description (home page and fallback) */
export const SITE_DESCRIPTION: Record<SeoLang, string> = {
  en: 'SynTools is a free online toolkit: JSON formatting, Base64/URL encoding, regex testing, text diff, timestamps, UUID and password generation, hashing, QR codes, colour and base conversion, Markdown preview, image compression, PDF merge/split/encrypt, and in-browser Word/Excel/PPT editing — all processed on the client, so files never leave the browser.',
  zh: 'SynTools 是免费的在线工具集：JSON 格式化、Base64/URL 编解码、正则测试、文本对比、时间戳转换、UUID/密码生成、哈希计算、二维码、颜色与进制转换、Markdown 预览、图片压缩、PDF 合并拆分加密、Word/Excel/PPT 在线编辑等，纯前端处理，数据不离开浏览器。',
};

/** Suffix for tool page descriptions (turns a tool blurb into a full page description) */
export const TOOL_DESCRIPTION_SUFFIX: Record<SeoLang, string> = {
  en: 'Processed entirely on the client; data never leaves your browser.',
  zh: '纯前端处理，数据不离开浏览器。',
};

export interface PageSeo {
  /** Page-level title without the site name */
  title: string;
  /** meta description */
  description: string;
}

/** SEO copy for static (non-tool) pages, keyed by language-agnostic path */
export const STATIC_PAGE_SEO: Record<SeoLang, Record<string, PageSeo>> = {
  en: {
    '/download/': {
      title: 'Download Desktop Community',
      description:
        'Download SynTools Desktop Community for macOS (Apple Silicon / Intel), Windows (x64 / ARM64) and Linux (deb / rpm / AppImage). Free under AGPL-3.0, fully offline, files stay on your machine — no network, no account.',
    },
    '/pricing/': {
      title: 'Pricing and Licensing',
      description:
        'SynTools pricing: every tool in the web app is free forever with unlimited use. Desktop and server lines each have a free AGPL-3.0 community edition; Desktop Pro and Enterprise Server are still being planned, with pricing published once settled.',
    },
    '/security/': {
      title: 'Security and Compliance',
      description:
        'SynTools security notes: fully static, no upload endpoint, CSP restricts egress to same origin, no third-party scripts or trackers, source published for offline audit — with the dependency licence list and procurement FAQ, ready for technical review.',
    },
    '/privacy/': {
      title: 'Privacy Notice',
      description:
        'SynTools privacy notice: file contents are never collected, no account is required, no tracking cookies, no third-party scripts. Locally we store only interface settings, favourites and drafts; analytics is off by default and never carries input content.',
    },
    '/about/': {
      title: 'About SynTools',
      description:
        'SynTools is a purely front-end online toolkit: encoding and formatting, image and photo editing, PDF processing, in-browser Word/Excel/PPT editing — all running locally, with no file uploads. Source is published under AGPL-3.0, with a commercial licence available.',
    },
  },
  zh: {
    '/download/': {
      title: '下载桌面社区版',
      description:
        'SynTools 桌面社区版下载：macOS（Apple Silicon / Intel）、Windows（x64 / ARM64）、Linux（deb / rpm / AppImage）。按 AGPL-3.0 免费授权，全功能离线可用，文件不出本机，无需联网、无需登录。',
    },
    '/pricing/': {
      title: '定价与商业许可',
      description:
        'SynTools 定价：网页版全部工具永久免费且不限次数。桌面端与服务器端各有一个免费的社区版（AGPL-3.0）；桌面专业版与企业服务器版仍在规划中，价格与授权方式确定后公布。',
    },
    '/security/': {
      title: '安全与合规',
      description:
        'SynTools 安全说明：纯静态、无上传接口、CSP 限制出站请求为同源、无第三方脚本与追踪、源码公开可离线审计。含依赖许可清单与采购常见问题，可直接用于技术评审。',
    },
    '/privacy/': {
      title: '隐私说明',
      description:
        'SynTools 隐私说明：不收集文件内容、不需要账号、不使用追踪 Cookie、不加载第三方脚本。本机只保存界面设置、收藏与草稿；统计埋点默认关闭且不含任何输入内容。',
    },
    '/about/': {
      title: '关于 SynTools',
      description:
        'SynTools 是一个纯前端的在线工具集：编码格式化、图片与照片编辑、PDF 处理、Word/Excel/PPT 浏览器编辑等，全部在本机运行，文件不上传。源码以 AGPL-3.0 公开，另提供商业许可。',
    },
  },
};

/** UI language → SEO language (zh-TW shares the Simplified copy: Traditional readers do better with it than with English) */
export function seoLangOf(lang: Lang): SeoLang {
  return lang === 'zh' || lang === 'zh-TW' ? 'zh' : 'en';
}

/** Build the full `<title>`; returns the site title when no page title is given */
export function pageTitle(title: string | null | undefined, lang: SeoLang): string {
  if (!title) return SITE_TITLE[lang];
  return `${title}${TITLE_SEP}${SITE_NAME[lang]}`;
}

/**
 * Look up static page copy by language-agnostic path.
 *
 * Accepts paths with or without a locale prefix or trailing slash, because prerendering writes
 * `/pricing/` while routing matches `/pricing`.
 */
export function staticPageSeo(path: string, lang: SeoLang): PageSeo | null {
  // Drop the optional locale prefix and query string, then normalize to a leading and trailing slash
  const bare = path.replace(/[?#].*$/, '').replace(/^\/zh(?=\/|$)/, '') || '/';
  const normalized = bare.endsWith('/') ? bare : `${bare}/`;
  if (normalized === '/') return { title: '', description: SITE_DESCRIPTION[lang] };
  return STATIC_PAGE_SEO[lang][normalized] ?? null;
}
