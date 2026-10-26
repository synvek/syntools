// 类型从 vitest/config 导入（其 re-export 的 vite 类型与 defineConfig 同一副本，
// 避免 vitest 内嵌 vite5 与顶层 vite6 的 Plugin 类型冲突）
import type { Plugin } from 'vitest/config';
import type { ToolMeta } from '../src/core/types';
import { createServer } from 'vite';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve as resolvePath } from 'node:path';

/**
 * SEO 预渲染插件（Tasks T31）：构建结束后为首页、工具页与静态页生成含
 * title / description / canonical / hreflang / Open Graph / JSON-LD 的静态 HTML，
 * 并在 `#root` 内注入可索引的正文骨架（H1 + 说明 + 站内内链），
 * 同时输出 robots.txt 与 sitemap.xml。
 *
 * **输出两棵语言树**（这是 2026-10 的改动）：
 *
 * | 目录 | 语言 | `<html lang>` |
 * | ---- | ---- | ------------- |
 * | `dist/`、`dist/tools/<id>/`、`dist/pricing/` … | en | `en` |
 * | `dist/zh/`、`dist/zh/tools/<id>/` … | zh-CN | `zh-CN` |
 *
 * 在此之前整站只有一套写死中文的 head，于是 Bing / Google 抓到的唯一结论是
 * 「这是中文站」——9 种界面语言对搜索引擎等于不存在。现在每条页面都带自己的
 * 语言声明与 `hreflang` 三向互指（en / zh-CN / x-default）。
 *
 * 说明：
 * - 在 closeBundle 阶段（产物已落盘）读取 dist/index.html 作为模板；
 * - 工具元数据、SEO 文案、语言包都经编程式 createServer + ssrLoadModule 读取
 *   （走 Vite 模块管线，自动解析整条依赖链上的 `@/` 别名；build 环境的插件上下文
 *   不提供 ssrLoadModule，vite.config.ts 又被 esbuild 打包无法静态 import 别名模块）。
 *   这条链上只有 type-only 导入与不执行的懒加载工厂，SSR 加载安全；
 * - 文案与运行时共用 `src/core/seo/copy.ts`，保证 head 里的标题/描述与页面
 *   切换语言后同步出来的值一致；
 * - Cloudflare Pages / Vercel 均优先返回真实静态文件，SPA fallback 不受影响；
 * - 注入的正文位于 `#root` 内：`createRoot().render()` 首次提交时会清空容器
 *   已有子节点，因此不会与 React 渲染结果重复；若 JS 未加载，用户仍能看到
 *   可读的静态内容（渐进增强，而非降级）。
 */

/** 站点根地址；生产构建未显式传 SITE_URL 时用它兜底，避免 sitemap / canonical 丢失 */
const DEFAULT_SITE_URL = 'https://www.syntools.net';

/** HTML 属性值转义（工具名/描述可能含 & " < > 等字符） */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** HTML 文本节点转义（比属性多处理单引号） */
function escapeText(value: string): string {
  return escapeAttr(value).replace(/'/g, '&#39;');
}

const BRAND = 'SynTools';

/**
 * 有独立 URL 的语言。顺序即 `hreflang` 的输出顺序，第一项同时是 `x-default`。
 * 与 `src/core/i18n/routing.ts` 的 `ROUTED_LANGS` 必须一致——两边都由
 * 「只有 en / zh 值得为 SEO 建路径」这个判断推导而来。
 */
const LOCALES = [
  { lang: 'en', prefix: '', htmlLang: 'en', ogLocale: 'en_US' },
  { lang: 'zh', prefix: '/zh', htmlLang: 'zh-CN', ogLocale: 'zh_CN' },
] as const;

type LocaleConf = (typeof LOCALES)[number];
type LocaleCode = LocaleConf['lang'];

/** 预渲染正文骨架的样式：内联注入，不依赖 JS，亮/暗色都保持可读 */
const SHELL_STYLE = `
/* 与 theme-init.js 一致地按系统偏好铺底色，避免 React 挂载前出现反色闪光 */
html { background: #ffffff; }
#root > .seo-shell {
  max-width: 56rem; margin: 0 auto; padding: 32px 24px 64px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 15px; line-height: 1.7; color: #111827;
}
#root > .seo-shell h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 .5rem; }
#root > .seo-shell .seo-lead { margin: 0 0 1.25rem; color: #4b5563; }
#root > .seo-shell h2 { font-size: 1rem; font-weight: 600; margin: 1.75rem 0 .5rem; }
#root > .seo-shell ul { margin: 0; padding-left: 1.15rem; }
#root > .seo-shell li { margin: .25rem 0; }
#root > .seo-shell a { color: #2563eb; text-decoration: none; }
#root > .seo-shell a:hover { text-decoration: underline; }
#root > .seo-shell .seo-note {
  margin-top: 1.5rem; padding: .75rem 1rem; border-radius: .5rem;
  background: #f3f4f6; color: #374151; font-size: .875rem;
}
@media (prefers-color-scheme: dark) {
  html { background: #030712; }
  #root > .seo-shell { color: #e5e7eb; }
  #root > .seo-shell .seo-lead { color: #9ca3af; }
  #root > .seo-shell a { color: #60a5fa; }
  #root > .seo-shell .seo-note { background: #1f2937; color: #d1d5db; }
}
`.trim();

/** 与语言无关的站点路径：静态页统一带尾斜杠，与静态托管目录结构一致 */
const STATIC_PATHS = ['/download/', '/pricing/', '/security/', '/privacy/', '/about/'] as const;

/** 给「语言无关路径」加前缀：`/pricing/` → `/zh/pricing/` */
function localize(path: string, conf: LocaleConf): string {
  return path === '/' ? `${conf.prefix}/` : `${conf.prefix}${path}`;
}

interface MetaOpts {
  title: string;
  description: string;
  siteUrl: string | null;
  path: string;
  /** 语言无关路径，用于生成三向 hreflang */
  barePath: string;
  locale: LocaleConf;
  /** 相对站点的 OG 图路径；不存在则回退品牌默认图，都没有则省略 */
  ogImage: string | null;
}

/** 站点通用 meta 标签（注入到 </head> 前） */
function buildMetaTags(opts: MetaOpts): string {
  const { title, description, siteUrl, path, barePath, locale, ogImage } = opts;
  const absolute = (p: string): string => (siteUrl ? siteUrl + p : p);
  const alternateLocale = LOCALES.find((l) => l.lang !== locale.lang);
  const tags = [
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<meta name="application-name" content="${BRAND}" />`,
    `<meta property="og:site_name" content="${BRAND}" />`,
    `<meta property="og:locale" content="${locale.ogLocale}" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    '<meta property="og:type" content="website" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
  ];
  if (alternateLocale) {
    tags.push(`<meta property="og:locale:alternate" content="${alternateLocale.ogLocale}" />`);
  }
  if (siteUrl) {
    tags.push(`<meta property="og:url" content="${escapeAttr(absolute(path))}" />`);
    tags.push(`<link rel="canonical" href="${escapeAttr(absolute(path))}" />`);
  }
  // hreflang 三向互指：每条 URL 都声明自己是哪一语言、另一语言在哪、默认指向谁。
  // 少任何一条，Google 都可能把两棵树当成重复内容只保留一棵。
  for (const alt of LOCALES) {
    const href = absolute(localize(barePath, alt));
    tags.push(`<link rel="alternate" hreflang="${alt.htmlLang}" href="${escapeAttr(href)}" />`);
  }
  tags.push(
    `<link rel="alternate" hreflang="x-default" href="${escapeAttr(absolute(localize(barePath, LOCALES[0])))}" />`,
  );
  if (ogImage) {
    const url = escapeAttr(absolute(ogImage));
    tags.push(`<meta property="og:image" content="${url}" />`);
    tags.push(`<meta property="og:image:width" content="1200" />`);
    tags.push('<meta property="og:image:height" content="630" />');
    tags.push(`<meta name="twitter:image" content="${url}" />`);
  }
  return tags.join('\n    ');
}

/** 工具页结构化数据：让搜索结果有机会出富摘要（免费在线工具 + 面包屑） */
function buildToolJsonLd(opts: {
  siteUrl: string | null;
  path: string;
  name: string;
  description: string;
  category: string;
  locale: LocaleConf;
}): string {
  const { siteUrl, path, name, description, category, locale } = opts;
  const url = siteUrl ? siteUrl + path : path;
  const home = localize('/', locale);
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name,
        description,
        url,
        applicationCategory: 'UtilitiesApplication',
        applicationSubCategory: category,
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript',
        inLanguage: locale.htmlLang,
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
        ...(siteUrl ? { publisher: { '@type': 'Organization', name: BRAND, url: siteUrl } } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: BRAND,
            item: siteUrl ? `${siteUrl}${home}` : home,
          },
          { '@type': 'ListItem', position: 2, name, item: url },
        ],
      },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

/** 正文骨架：React 挂载后被替换，但爬虫与无 JS 环境可读 */
function buildShell(bodyHtml: string): string {
  return `<div class="seo-shell">${bodyHtml}</div>`;
}

function buildSitemap(siteUrl: string, barePaths: string[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = barePaths
    .flatMap((bare) =>
      LOCALES.map((conf) => {
        const alternates = LOCALES.map(
          (alt) =>
            `    <xhtml:link rel="alternate" hreflang="${alt.htmlLang}" href="${escapeAttr(siteUrl + localize(bare, alt))}" />`,
        ).join('\n');
        const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeAttr(siteUrl + localize(bare, LOCALES[0]))}" />`;
        return `  <url>\n    <loc>${escapeAttr(siteUrl + localize(bare, conf))}</loc>\n${alternates}\n${xDefault}\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>`;
      }),
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

type PrerenderTool = Pick<
  ToolMeta,
  'id' | 'name' | 'description' | 'category' | 'weight' | 'relatedIds'
>;

/** 语言包中预渲染用到的部分 */
interface LocaleShell {
  categories?: Record<string, string>;
  toolsMeta?: Record<string, { name?: string; description?: string }>;
}

/** SEO 文案模块的形状（与 src/core/seo/copy.ts 对应） */
interface SeoCopyModule {
  SITE_TITLE: Record<LocaleCode, string>;
  SITE_DESCRIPTION: Record<LocaleCode, string>;
  TOOL_DESCRIPTION_SUFFIX: Record<LocaleCode, string>;
  STATIC_PAGE_SEO: Record<LocaleCode, Record<string, { title: string; description: string }>>;
  pageTitle: (title: string | null | undefined, lang: LocaleCode) => string;
}

/** 只给预渲染用的正文素材（与 src/core/seo/sections.ts 对应） */
interface SeoSectionsModule {
  SHELL_TEXT: Record<LocaleCode, SeoShellText>;
  STATIC_PAGE_SECTIONS: Record<LocaleCode, Record<string, SeoSection[]>>;
}

interface SeoSection {
  heading: string;
  items: string[];
}

interface SeoShellText {
  homeH1: string;
  homeNote: string;
  toolNote: string;
  relatedHeading: string;
  allTools: string;
  downloadDesktop: string;
  staticNote: string;
  toolCountSuffix: string;
}

interface SsrBundle {
  tools: PrerenderTool[];
  seo: SeoCopyModule;
  sections: SeoSectionsModule;
  shells: Record<LocaleCode, LocaleShell>;
}

/** 经编程式 dev server 的 SSR 管线加载注册表 / 文案 / 语言包（解析 @/ 别名） */
async function loadSsr(root: string): Promise<SsrBundle> {
  const server = await createServer({
    configFile: false,
    root,
    resolve: { alias: { '@': resolvePath(root, 'src') } },
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
    logLevel: 'silent',
  });
  try {
    const registry = (await server.ssrLoadModule('@/core/registry')) as { tools: PrerenderTool[] };
    const seo = (await server.ssrLoadModule('@/core/seo/copy')) as SeoCopyModule;
    const sections = (await server.ssrLoadModule('@/core/seo/sections')) as SeoSectionsModule;
    const en = (await server.ssrLoadModule('@/core/i18n/locales/en')) as { default: LocaleShell };
    const zh = (await server.ssrLoadModule('@/core/i18n/locales/zh')) as { default: LocaleShell };
    return { tools: registry.tools, seo, sections, shells: { en: en.default, zh: zh.default } };
  } finally {
    await server.close();
  }
}

/** 读取已生成的 OG 图清单（构建前放 public/og/<id>.png 即可按工具出图） */
async function readOgImages(distDir: string): Promise<Set<string>> {
  try {
    const files = await readdir(resolvePath(distDir, 'og'));
    return new Set(files.filter((f) => f.endsWith('.png')));
  } catch {
    return new Set();
  }
}

export function prerenderPlugin(): Plugin {
  let root = process.cwd();
  let outDir = 'dist';

  return {
    name: 'syntools-prerender',
    apply: 'build',
    configResolved(resolved) {
      root = resolved.root || process.cwd();
      outDir = resolved.build.outDir || 'dist';
    },
    async closeBundle() {
      const siteUrl = (process.env.SITE_URL?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, '');
      const distDir = resolvePath(root, outDir);
      const indexPath = resolvePath(distDir, 'index.html');

      let template: string;
      try {
        template = await readFile(indexPath, 'utf-8');
      } catch {
        console.warn('[prerender] 未找到 dist/index.html，跳过预渲染');
        return;
      }

      let bundle: SsrBundle;
      try {
        bundle = await loadSsr(root);
      } catch (err) {
        console.warn('[prerender] 加载注册表失败，跳过预渲染：', err);
        return;
      }
      const { tools, seo, sections, shells } = bundle;

      const ogFiles = await readOgImages(distDir);
      const hasDefaultOg = ogFiles.has('default.png');
      const defaultOg = hasDefaultOg ? '/og/default.png' : null;

      /** 某个语言下的工具名与说明；缺译文时退回注册表里的中文原文 */
      const toolText = (
        tool: PrerenderTool,
        lang: LocaleCode,
      ): { name: string; description: string } => {
        const meta = shells[lang]?.toolsMeta?.[tool.id];
        return {
          name: meta?.name || tool.name,
          description: meta?.description || tool.description,
        };
      };

      /** 每个工具取同分类的其它工具作为内链（有 relatedIds 时优先），最多 8 个 */
      const relatedOf = (tool: PrerenderTool): PrerenderTool[] => {
        const byId = new Map(tools.map((t) => [t.id, t]));
        if (tool.relatedIds?.length) {
          return tool.relatedIds
            .map((id) => byId.get(id))
            .filter((t): t is PrerenderTool => Boolean(t))
            .slice(0, 8);
        }
        return tools.filter((t) => t.id !== tool.id && t.category === tool.category).slice(0, 8);
      };

      const render = (opts: {
        title: string;
        description: string;
        path: string;
        barePath: string;
        locale: LocaleConf;
        bodyHtml: string;
        ogImage: string | null;
        jsonLd?: string;
      }): string => {
        const head = [
          buildMetaTags({
            title: opts.title,
            description: opts.description,
            siteUrl,
            path: opts.path,
            barePath: opts.barePath,
            locale: opts.locale,
            ogImage: opts.ogImage,
          }),
          opts.jsonLd ?? '',
          `<style>${SHELL_STYLE}</style>`,
        ]
          .filter(Boolean)
          .join('\n    ');
        return (
          template
            .replace(/<html[^>]*>/, `<html lang="${opts.locale.htmlLang}">`)
            .replace(/<title>[^<]*<\/title>/, `<title>${escapeText(opts.title)}</title>`)
            // 模板里的 title / description 是英文兜底，预渲染页面必须换成自己的
            .replace(/<meta\s+name="description"[^>]*>\s*/i, '')
            .replace('</head>', `    ${head}\n  </head>`)
            .replace('<div id="root"></div>', `<div id="root">${buildShell(opts.bodyHtml)}</div>`)
        );
      };

      const written: string[] = [];

      for (const locale of LOCALES) {
        const ctx: LocaleCtx = {
          locale,
          shell: shells[locale.lang],
          text: sections.SHELL_TEXT[locale.lang],
          seo,
          href: (path: string) => localize(path, locale),
          staticPage: (bare: string) => {
            const page = seo.STATIC_PAGE_SEO[locale.lang][bare];
            if (!page) return null;
            return {
              ...page,
              sections: sections.STATIC_PAGE_SECTIONS[locale.lang][bare] ?? [],
            };
          },
        };

        // 首页：注入站点级 meta + 全量分类内链（给爬虫一张完整地图）
        const homePath = localize('/', locale);
        const homeFile = resolvePath(distDir, homePath.replace(/^\/+/, ''), 'index.html');
        await mkdir(dirname(homeFile), { recursive: true });
        await writeFile(
          homeFile,
          render({
            title: seo.SITE_TITLE[locale.lang],
            description: seo.SITE_DESCRIPTION[locale.lang],
            path: homePath,
            barePath: '/',
            locale,
            bodyHtml: buildHomeBody(tools, ctx),
            ogImage: defaultOg,
          }),
          'utf-8',
        );
        written.push(homePath);

        // 工具页：/tools/<id>/index.html（静态托管优先于 SPA fallback 命中）
        for (const tool of tools) {
          const bare = `/tools/${tool.id}/`;
          const path = ctx.href(bare);
          const { name, description } = toolText(tool, locale.lang);
          const og = ogFiles.has(`${tool.id}.png`) ? `/og/${tool.id}.png` : defaultOg;
          const file = resolvePath(distDir, path.replace(/^\/+/, ''), 'index.html');
          await mkdir(dirname(file), { recursive: true });
          await writeFile(
            file,
            render({
              title: seo.pageTitle(name, locale.lang),
              description: `${description} ${seo.TOOL_DESCRIPTION_SUFFIX[locale.lang]}`,
              path,
              barePath: bare,
              locale,
              bodyHtml: buildToolBody(tool, relatedOf(tool), ctx),
              ogImage: og,
              jsonLd: buildToolJsonLd({
                siteUrl,
                path,
                name,
                description,
                category: tool.category,
                locale,
              }),
            }),
            'utf-8',
          );
          written.push(path);
        }

        // 静态页：/download/ /pricing/ /security/ /privacy/ /about/
        for (const bare of STATIC_PATHS) {
          const page = ctx.staticPage(bare);
          if (!page) {
            console.warn(`[prerender] 缺少 ${locale.lang} 的静态页文案：${bare}`);
            continue;
          }
          const path = ctx.href(bare);
          const file = resolvePath(distDir, path.replace(/^\/+/, ''), 'index.html');
          await mkdir(dirname(file), { recursive: true });
          await writeFile(
            file,
            render({
              title: seo.pageTitle(page.title, locale.lang),
              description: page.description,
              path,
              barePath: bare,
              locale,
              bodyHtml: buildStaticBody(page, bare, tools.length, ctx),
              ogImage: defaultOg,
            }),
            'utf-8',
          );
          written.push(path);
        }
      }

      // robots.txt
      //
      // 立场：允许检索与「答案引擎」抓取，但保留对训练用途的权利（EU DSM 第 4 条）。
      // 这是刻意的选择 —— 工具站的流量全部来自「被搜到 / 被 AI 引用」，
      // 用 Disallow 把抓取挡掉等于自断入口；而 Content-Signal 只是权利声明，
      // 不影响抓取，两者可以同时成立。
      //
      // 注意：Cloudflare 的 AI Crawl Control 若开启了「托管 robots.txt /
      // Bot Preference Sync」，会在本文件**前面**注入一大段 Disallow，
      // 并在边缘直接返回 403（实测 GPTBot / ClaudeBot 会 403）。
      // 那种情况下改这个文件无效，必须去控制台关掉那个开关。
      const robots = [
        '# 欢迎检索与答案引擎抓取，包括 Baiduspider / Bingbot / GPTBot / ClaudeBot',
        '',
        '# Baiduspider 单独成组：本站无 ICP 备案（境外托管），百度后台的',
        '# 「普通收录 → sitemap」提交配额固定为 0 条/日，按钮置灰不可用。',
        '# 百度此时唯一可用的 sitemap 通道，是它读取 robots.txt 时发现的',
        '# Sitemap 指令 —— 因此这条必须写在 Baiduspider 自己的分组里。',
        'User-agent: Baiduspider',
        'Allow: /',
        `Sitemap: ${siteUrl}/sitemap.xml`,
        '',
        'User-agent: *',
        'Allow: /',
        '',
        '# 权利保留：允许索引与引用，不授权用于模型训练',
        'Content-Signal: search=yes, ai-train=no, use=reference',
        '',
        `Sitemap: ${siteUrl}/sitemap.xml`,
        '',
      ].join('\n');
      await writeFile(resolvePath(distDir, 'robots.txt'), robots, 'utf-8');

      // sitemap.xml：每条「语言无关路径」展开成两条 URL，各自带三向 alternates
      const barePaths = ['/', ...STATIC_PATHS, ...tools.map((tool) => `/tools/${tool.id}/`)];
      await writeFile(
        resolvePath(distDir, 'sitemap.xml'),
        buildSitemap(siteUrl, barePaths),
        'utf-8',
      );

      // GitHub Pages：无服务端 SPA fallback，用 404.html 回退到应用壳
      await writeFile(
        resolvePath(distDir, '404.html'),
        await readFile(indexPath, 'utf-8'),
        'utf-8',
      );
      // 禁止 Jekyll 处理，保留 _headers 等以下划线开头的文件
      await writeFile(resolvePath(distDir, '.nojekyll'), '', 'utf-8');

      console.log(
        `预渲染完成：${LOCALES.length} 种语言 × ${tools.length} 个工具页 + ${STATIC_PATHS.length} 个静态页 = ${written.length} 个页面 + robots.txt + sitemap.xml（${barePaths.length * LOCALES.length} 个 URL）+ 404.html`,
      );
    },
  };
}

/**
 * 单个语言下生成正文骨架所需的上下文。
 *
 * 打包成一个对象而不是六个位置参数：三个骨架函数都要用其中大半，
 * 逐个传会让调用处变成一长串看不出含义的 `locale, seo, shell, href`。
 */
interface LocaleCtx {
  locale: LocaleConf;
  /** 该语言的外壳语言包（分类名、toolsMeta） */
  shell: LocaleShell;
  /** 骨架里的固定句子 */
  text: SeoShellText;
  seo: SeoCopyModule;
  /** 站内链接加上语言前缀 */
  href: (path: string) => string;
  /** 取静态页文案 + 该语言的小节 */
  staticPage: (
    bare: string,
  ) => { title: string; description: string; sections: SeoSection[] } | null;
}

/** 首页正文骨架：按分类列出全部工具，形成可抓取的站内链接图 */
function buildHomeBody(tools: PrerenderTool[], ctx: LocaleCtx): string {
  const byCategory = new Map<string, PrerenderTool[]>();
  for (const tool of tools) {
    const list = byCategory.get(tool.category) ?? [];
    list.push(tool);
    byCategory.set(tool.category, list);
  }
  const sections = [...byCategory.entries()]
    .map(([category, list]) => {
      const items = list
        .map((tool) => {
          const meta = ctx.shell.toolsMeta?.[tool.id];
          const name = meta?.name || tool.name;
          return `<li><a href="${ctx.href(`/tools/${tool.id}/`)}">${escapeText(name)}</a></li>`;
        })
        .join('');
      const label = ctx.shell.categories?.[category] ?? category;
      return `<h2>${escapeText(label)}</h2><ul>${items}</ul>`;
    })
    .join('');
  return [
    `<h1>${escapeText(ctx.text.homeH1)}</h1>`,
    `<p class="seo-lead">${escapeText(ctx.seo.SITE_DESCRIPTION[ctx.locale.lang])}</p>`,
    sections,
    `<p class="seo-note">${escapeText(ctx.text.homeNote)}</p>`,
  ].join('');
}

/** 静态页正文骨架：标题 + 一句话说明 + 小节 + 站内互链 */
function buildStaticBody(
  page: { title: string; description: string; sections: SeoSection[] },
  barePath: string,
  toolCount: number,
  ctx: LocaleCtx,
): string {
  const sections = page.sections
    .map(
      (section) =>
        `<h2>${escapeText(section.heading)}</h2><ul>${section.items
          .map((item) => `<li>${escapeText(item)}</li>`)
          .join('')}</ul>`,
    )
    .join('');
  // 互链只连「有文案」的页，避免静态骨架里出现空标题链接
  const siblings = STATIC_PATHS.filter((path) => path !== barePath && ctx.staticPage(path))
    .map((path) => `<a href="${ctx.href(path)}">${escapeText(ctx.staticPage(path)!.title)}</a>`)
    .join(' · ');
  return [
    `<h1>${escapeText(page.title)}</h1>`,
    `<p class="seo-lead">${escapeText(page.description)}</p>`,
    sections,
    `<p class="seo-note">${escapeText(ctx.text.staticNote)}</p>`,
    `<p>${siblings} · <a href="${ctx.href('/')}">${escapeText(ctx.text.allTools)}（${toolCount} ${escapeText(ctx.text.toolCountSuffix)}）</a></p>`,
  ].join('');
}

/** 工具页正文骨架：说明 + 同分类内链 + 返回入口 */
function buildToolBody(tool: PrerenderTool, related: PrerenderTool[], ctx: LocaleCtx): string {
  const self = ctx.shell.toolsMeta?.[tool.id];
  const relatedHtml = related.length
    ? `<h2>${escapeText(ctx.text.relatedHeading)}</h2><ul>${related
        .map((item) => {
          const meta = ctx.shell.toolsMeta?.[item.id];
          const name = meta?.name || item.name;
          return `<li><a href="${ctx.href(`/tools/${item.id}/`)}">${escapeText(name)}</a></li>`;
        })
        .join('')}</ul>`
    : '';
  return [
    `<h1>${escapeText(self?.name || tool.name)}</h1>`,
    `<p class="seo-lead">${escapeText(self?.description || tool.description)}</p>`,
    `<p class="seo-note">${escapeText(ctx.text.toolNote)}</p>`,
    relatedHtml,
    `<p><a href="${ctx.href('/')}">${escapeText(ctx.text.allTools)}</a> · <a href="${ctx.href('/download/')}">${escapeText(ctx.text.downloadDesktop)}</a></p>`,
  ].join('');
}
