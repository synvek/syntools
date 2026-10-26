import type { Lang } from '@/core/i18n/types';

/**
 * 面向搜索引擎的**运行期**文案：站点级标题、描述、静态页的一句话描述。
 *
 * 为什么要和 `sections.ts` 拆开：
 * `scripts/prerender.ts` 需要为无 JS 环境生成整段可读正文（小节标题 + 每节若干条目），
 * 但浏览器里的 `core/seo/meta.ts` 只需要 title 与 description。把两者放同一个模块，
 * 等于让每个访客都下载一遍只给爬虫看的正文——首屏预算只有 195 KB，没理由这么花。
 *
 * 两份文案都只覆盖 en 与 zh：只有这两种语言有独立 URL，其余 7 种界面语言不做 SEO 路径。
 */

/** 有 SEO 文案的语言（与 `ROUTED_LANGS` 一一对应） */
export type SeoLang = 'en' | 'zh';

export const SEO_LANGS: readonly SeoLang[] = ['en', 'zh'];

/** 站点名：同时用于 `<title>` 后缀、og:site_name、JSON-LD publisher */
export const SITE_NAME: Record<SeoLang, string> = {
  en: 'SynTools',
  zh: 'SynTools',
};

/** 标题分隔符：中英文统一用「空格 - 空格」，与页面内既有写法保持一致 */
const TITLE_SEP = ' - ';

/**
 * 站点级 `<title>`（首页与兜底）。
 *
 * 刻意只有站点名 + 一句定位，不堆关键词：搜索结果里的标题被截断到 60 字符左右，
 * 堆词只会让品牌名一起被截掉。
 */
export const SITE_TITLE: Record<SeoLang, string> = {
  en: `SynTools${TITLE_SEP}Online Toolkit`,
  zh: `SynTools${TITLE_SEP}在线工具集`,
};

/** 站点级一句话描述（首页与兜底用） */
export const SITE_DESCRIPTION: Record<SeoLang, string> = {
  en: 'SynTools is a free online toolkit: JSON formatting, Base64/URL encoding, regex testing, text diff, timestamps, UUID and password generation, hashing, QR codes, colour and base conversion, Markdown preview, image compression, PDF merge/split/encrypt, and in-browser Word/Excel/PPT editing — all processed on the client, so files never leave the browser.',
  zh: 'SynTools 是免费的在线工具集：JSON 格式化、Base64/URL 编解码、正则测试、文本对比、时间戳转换、UUID/密码生成、哈希计算、二维码、颜色与进制转换、Markdown 预览、图片压缩、PDF 合并拆分加密、Word/Excel/PPT 在线编辑等，纯前端处理，数据不离开浏览器。',
};

/** 工具页描述的后缀（把「工具说明」变成一句完整的页面描述） */
export const TOOL_DESCRIPTION_SUFFIX: Record<SeoLang, string> = {
  en: 'Processed entirely on the client; data never leaves your browser.',
  zh: '纯前端处理，数据不离开浏览器。',
};

export interface PageSeo {
  /** 页面级标题，不含站点名 */
  title: string;
  /** meta description */
  description: string;
}

/** 静态页（非工具页）的 SEO 文案，键为语言无关路径 */
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

/** 界面语言 → SEO 语言（zh-TW 与简体共用一套描述：繁体用户读简体远好于读英文） */
export function seoLangOf(lang: Lang): SeoLang {
  return lang === 'zh' || lang === 'zh-TW' ? 'zh' : 'en';
}

/** 拼出完整的 `<title>`；不传页面标题时返回站点标题 */
export function pageTitle(title: string | null | undefined, lang: SeoLang): string {
  if (!title) return SITE_TITLE[lang];
  return `${title}${TITLE_SEP}${SITE_NAME[lang]}`;
}

/**
 * 按「语言无关路径」取静态页文案。
 *
 * 接受带或不带语言前缀、带或不带尾斜杠的写法，因为预渲染落盘用的是
 * `/pricing/`，而路由匹配到的是 `/pricing`。
 */
export function staticPageSeo(path: string, lang: SeoLang): PageSeo | null {
  // 去掉可选的语言前缀与查询串，再统一成「前后都有斜杠」的规范形式
  const bare = path.replace(/[?#].*$/, '').replace(/^\/zh(?=\/|$)/, '') || '/';
  const normalized = bare.endsWith('/') ? bare : `${bare}/`;
  if (normalized === '/') return { title: '', description: SITE_DESCRIPTION[lang] };
  return STATIC_PAGE_SEO[lang][normalized] ?? null;
}
