// Import the type from vitest/config: its re-exported vite types share a copy with defineConfig,
// avoiding a Plugin type clash between vitest's bundled vite5 and the top-level vite6
import type { Plugin } from 'vitest/config';
import type { ToolMeta } from '../src/core/types';
import { createServer } from 'vite';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve as resolvePath } from 'node:path';

/**
 * SEO prerender plugin (Tasks T31): after the build it generates static HTML for the home page,
 * tool pages and static pages with title / description / canonical / hreflang / Open Graph /
 * JSON-LD, injects an indexable content shell into `#root` (H1 + copy + internal links), and
 * also emits robots.txt and sitemap.xml.
 *
 * **Two language trees are written** (this changed in 2026-10):
 *
 * | Directory | Language | `<html lang>` |
 * | ---- | ---- | ------------- |
 * | `dist/`, `dist/tools/<id>/`, `dist/pricing/` … | en | `en` |
 * | `dist/zh/`, `dist/zh/tools/<id>/` … | zh-CN | `zh-CN` |
 *
 * Before this the whole site had one hard-coded Chinese head, so all Bing / Google concluded
 * was "a Chinese site" — the 9 UI languages effectively did not exist for search engines.
 * Now every page declares its language and the three-way `hreflang` set (en / zh-CN / x-default).
 *
 * Notes:
 * - During closeBundle (artifacts already on disk) dist/index.html is read as the template;
 * - Tool metadata, SEO copy and locale bundles are read via a programmatic createServer +
 *   ssrLoadModule (through the Vite module pipeline, which resolves `@/` aliases along the whole
 *   dependency chain; the build-time plugin context has no ssrLoadModule, and vite.config.ts is
 *   bundled by esbuild so alias modules cannot be statically imported).
 *   That chain only contains type-only imports and lazy factories that never run, so SSR is safe;
 * - Copy is shared with the runtime through `src/core/seo/copy.ts`, so head titles/descriptions
 *   match what the page produces after a language switch;
 * - Cloudflare Pages / Vercel serve real static files first, so SPA fallback is unaffected;
 * - The injected body lives inside `#root`: the first `createRoot().render()` commit clears
 *   existing children, so it never duplicates the React output; if JS never loads, users still
 *   get readable static content (progressive enhancement, not degradation).
 */

/** Site root URL; fallback when a production build passes no SITE_URL, so sitemap / canonical are never lost */
const DEFAULT_SITE_URL = 'https://www.syntools.net';

/** Escapes HTML attribute values (tool names/descriptions may contain & " < > and friends) */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escapes HTML text nodes (handles single quotes on top of attribute escaping) */
function escapeText(value: string): string {
  return escapeAttr(value).replace(/'/g, '&#39;');
}

const BRAND = 'SynTools';

/**
 * Languages with their own URL. The order is the `hreflang` output order and the first entry
 * is also `x-default`. Must match `ROUTED_LANGS` in `src/core/i18n/routing.ts` — both derive
 * from the same call: only en / zh are worth separate paths for SEO.
 */
const LOCALES = [
  { lang: 'en', prefix: '', htmlLang: 'en', ogLocale: 'en_US' },
  { lang: 'zh', prefix: '/zh', htmlLang: 'zh-CN', ogLocale: 'zh_CN' },
] as const;

type LocaleConf = (typeof LOCALES)[number];
type LocaleCode = LocaleConf['lang'];

/** Style for the prerendered content shell: inlined, JS-free, readable in light and dark */
const SHELL_STYLE = `
/* Paint the base colour from the system preference like theme-init.js, avoiding a colour flash before React mounts */
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

/** Language-neutral site paths: static pages keep a trailing slash to match the hosting directory layout */
const STATIC_PATHS = ['/download/', '/pricing/', '/security/', '/privacy/', '/about/'] as const;

/** Prefixes a language-neutral path: `/pricing/` → `/zh/pricing/` */
function localize(path: string, conf: LocaleConf): string {
  return path === '/' ? `${conf.prefix}/` : `${conf.prefix}${path}`;
}

interface MetaOpts {
  title: string;
  description: string;
  siteUrl: string | null;
  path: string;
  /** Language-neutral path, used to build the three-way hreflang */
  barePath: string;
  locale: LocaleConf;
  /** Site-relative OG image path; falls back to the brand default, omitted when neither exists */
  ogImage: string | null;
}

/** Shared site meta tags (injected before </head>) */
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
  // Three-way hreflang: every URL states its own language, where the other one lives, and the
  // default. Miss any one and Google may treat the two trees as duplicates and keep just one.
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

/** Tool page structured data, giving search results a chance at rich snippets (free online tool + breadcrumbs) */
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

/** Content shell: replaced once React mounts, but readable by crawlers and no-JS clients */
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

/** The parts of the locale bundle used by prerendering */
interface LocaleShell {
  categories?: Record<string, string>;
  toolsMeta?: Record<string, { name?: string; description?: string }>;
}

/** Shape of the SEO copy module (matches src/core/seo/copy.ts) */
interface SeoCopyModule {
  SITE_TITLE: Record<LocaleCode, string>;
  SITE_DESCRIPTION: Record<LocaleCode, string>;
  TOOL_DESCRIPTION_SUFFIX: Record<LocaleCode, string>;
  STATIC_PAGE_SEO: Record<LocaleCode, Record<string, { title: string; description: string }>>;
  pageTitle: (title: string | null | undefined, lang: LocaleCode) => string;
}

/** Body material used only for prerendering (matches src/core/seo/sections.ts) */
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

/** Loads registry / copy / locale bundles through a programmatic dev server's SSR pipeline (resolves @/ aliases) */
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

/** Reads the generated OG image list (drop public/og/<id>.png before building to get per-tool images) */
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
        console.warn('[prerender] dist/index.html not found, skipping prerender');
        return;
      }

      let bundle: SsrBundle;
      try {
        bundle = await loadSsr(root);
      } catch (err) {
        console.warn('[prerender] failed to load the registry, skipping prerender:', err);
        return;
      }
      const { tools, seo, sections, shells } = bundle;

      const ogFiles = await readOgImages(distDir);
      const hasDefaultOg = ogFiles.has('default.png');
      const defaultOg = hasDefaultOg ? '/og/default.png' : null;

      /** Tool name and description for a language; falls back to the registry's Chinese original */
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

      /** Other tools in the same category as internal links (relatedIds first), at most 8 */
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
            // The template's title / description are the English fallback; prerendered pages must replace them
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

        // Home: site-level meta plus a full category link map (a complete map for crawlers)
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

        // Tool pages: /tools/<id>/index.html (static hosting wins over the SPA fallback)
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

        // Static pages: /download/ /pricing/ /security/ /privacy/ /about/
        for (const bare of STATIC_PATHS) {
          const page = ctx.staticPage(bare);
          if (!page) {
            console.warn(`[prerender] missing ${locale.lang} copy for static page: ${bare}`);
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
      // Position: allow search and "answer engine" crawling, but reserve rights for training use
      // (EU DSM Article 4). This is deliberate — a tool site's traffic comes entirely from "being
      // found / being cited by AI", so blocking crawlers with Disallow cuts off its own entry
      // point; Content-Signal is merely a rights statement and does not affect crawling, so both
      // can hold at once.
      //
      // Note: if Cloudflare's AI Crawl Control enables "managed robots.txt / Bot Preference
      // Sync", it injects a large Disallow block **in front of** this file and returns 403 at the
      // edge (GPTBot / ClaudeBot were observed getting 403). Editing this file cannot help then;
      // turn that switch off in the dashboard.
      const robots = [
        '# Search and answer-engine crawling is welcome, including Baiduspider / Bingbot / GPTBot / ClaudeBot',
        '',
        '# Baiduspider gets its own group: the site has no ICP filing (hosted abroad), so the',
        '# "regular indexing -> sitemap" quota in Baidu Webmaster is fixed at 0/day and the UI is greyed out.',
        '# The only sitemap channel Baidu still honours is the Sitemap directive it finds while',
        '# reading robots.txt — hence it must live inside the Baiduspider group itself.',
        'User-agent: Baiduspider',
        'Allow: /',
        `Sitemap: ${siteUrl}/sitemap.xml`,
        '',
        'User-agent: *',
        'Allow: /',
        '',
        '# Rights reserved: indexing and citation allowed, model training not licensed',
        'Content-Signal: search=yes, ai-train=no, use=reference',
        '',
        `Sitemap: ${siteUrl}/sitemap.xml`,
        '',
      ].join('\n');
      await writeFile(resolvePath(distDir, 'robots.txt'), robots, 'utf-8');

      // sitemap.xml: each language-neutral path expands into two URLs, each with three-way alternates
      const barePaths = ['/', ...STATIC_PATHS, ...tools.map((tool) => `/tools/${tool.id}/`)];
      await writeFile(
        resolvePath(distDir, 'sitemap.xml'),
        buildSitemap(siteUrl, barePaths),
        'utf-8',
      );

      // GitHub Pages: no server-side SPA fallback, so 404.html falls back to the app shell
      await writeFile(
        resolvePath(distDir, '404.html'),
        await readFile(indexPath, 'utf-8'),
        'utf-8',
      );
      // Disable Jekyll so underscore-prefixed files such as _headers are kept
      await writeFile(resolvePath(distDir, '.nojekyll'), '', 'utf-8');

      console.log(
        `Prerender complete: ${LOCALES.length} languages × ${tools.length} tool pages + ${STATIC_PATHS.length} static pages = ${written.length} pages + robots.txt + sitemap.xml (${barePaths.length * LOCALES.length} URLs) + 404.html`,
      );
    },
  };
}

/**
 * Context needed to build the content shell for one language.
 *
 * Bundled into an object instead of six positional arguments: all three shell builders use most
 * of it, and passing them individually makes call sites unreadable `locale, seo, shell, href` runs.
 */
interface LocaleCtx {
  locale: LocaleConf;
  /** The shell locale bundle for this language (category names, toolsMeta) */
  shell: LocaleShell;
  /** Fixed sentences used in the shell */
  text: SeoShellText;
  seo: SeoCopyModule;
  /** Adds the language prefix to an in-site link */
  href: (path: string) => string;
  /** Gets static page copy plus that language's sections */
  staticPage: (
    bare: string,
  ) => { title: string; description: string; sections: SeoSection[] } | null;
}

/** Home shell: lists every tool by category, forming a crawlable internal link map */
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

/** Static page shell: title + one-line lead + sections + cross links */
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
  // Only link pages that have copy, so the shell never shows a link with an empty title
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

/** Tool page shell: description + same-category links + entry back to the site */
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
