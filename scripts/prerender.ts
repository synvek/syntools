// 类型从 vitest/config 导入（其 re-export 的 vite 类型与 defineConfig 同一副本，
// 避免 vitest 内嵌 vite5 与顶层 vite6 的 Plugin 类型冲突）
import type { Plugin } from 'vitest/config';
import type { ToolMeta } from '../src/core/types';
import { createServer } from 'vite';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve as resolvePath } from 'node:path';

/**
 * SEO 预渲染插件（Tasks T31）：构建结束后为首页、工具页与静态页生成含
 * title / description / canonical / Open Graph / JSON-LD 的静态 HTML，
 * 并在 `#root` 内注入可索引的正文骨架（H1 + 说明 + 站内内链），
 * 同时输出 robots.txt 与 sitemap.xml。
 *
 * 说明：
 * - 在 closeBundle 阶段（产物已落盘）读取 dist/index.html 作为模板；
 * - 工具元数据经编程式 createServer + ssrLoadModule 从注册表读取（走 Vite
 *   模块管线，自动解析整条依赖链上的 `@/` 别名；build 环境的插件上下文不提供
 *   ssrLoadModule，vite.config.ts 又被 esbuild 打包无法静态 import 别名模块）。
 *   注册表链上只有 type-only 导入与不执行的懒加载工厂，SSR 加载安全；
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

const SITE_NAME = 'SynTools - 在线工具集';
const BRAND = 'SynTools';
const SITE_DESCRIPTION =
  'SynTools 是免费的在线工具集：JSON 格式化、Base64/URL 编解码、正则测试、文本对比、时间戳转换、UUID/密码生成、哈希计算、二维码、颜色与进制转换、Markdown 预览、图片压缩、PDF 合并拆分加密、Word/Excel/PPT 在线编辑等，纯前端处理，数据不离开浏览器。';

/** 静态页（非工具页）配置：路径统一带尾斜杠，与静态托管目录结构一致 */
interface StaticPage {
  path: string;
  title: string;
  description: string;
  /**
   * 正文骨架的小节。除了给爬虫可读内容，它也决定了「无 JS 首屏」看到什么：
   * 定价与安全这两页是企业采购最先打开的页面，骨架里必须出现真实结论
   * （多少钱、CSP 限制了什么），而不是一句「请开启 JavaScript」。
   */
  sections?: { heading: string; items: string[] }[];
}

const STATIC_PAGES: StaticPage[] = [
  {
    path: '/download/',
    title: `下载桌面社区版 - ${SITE_NAME}`,
    description:
      'SynTools 桌面社区版下载：macOS（Apple Silicon / Intel）、Windows（x64 / ARM64）、Linux（deb / rpm / AppImage）。按 AGPL-3.0 免费授权，全功能离线可用，文件不出本机，无需联网、无需登录。',
  },
  {
    path: '/pricing/',
    title: `定价与商业许可 - ${SITE_NAME}`,
    description:
      'SynTools 定价：网页版全部工具永久免费且不限次数。桌面端与服务器端各有一个免费的社区版（AGPL-3.0）；桌面专业版与企业服务器版仍在规划中，价格与授权方式确定后公布。',
    sections: [
      {
        heading: '网页版（免费）',
        items: [
          '全部工具不限次数使用，单文件处理无限制',
          '无需注册、无需安装，文件在浏览器内处理且不上传',
          '不加水印、不降精度、不设等待倒计时',
        ],
      },
      {
        heading: '桌面端：社区版（免费）与专业版（规划中）',
        items: [
          '社区版按 AGPL-3.0 提供：没有浏览器标签页内存上限，可完全离线运行',
          '以源码或安装包形式提供，可自行构建与改动，内部自用不受开源义务约束',
          '专业版的功能范围、授权方式与价格仍在规划中，确定后在定价页公布',
        ],
      },
      {
        heading: '服务器端：社区服务器版（免费）与企业服务器版（规划中）',
        items: [
          '同一份构建产物：纯静态站点，不需要数据库，也没有服务端进程',
          '社区服务器版按 AGPL-3.0 提供：docker-compose 或任意静态服务器自助部署，无外部请求',
          '企业服务器版的授权方式、维保条款与价格仍在规划中',
        ],
      },
    ],
  },
  {
    path: '/security/',
    title: `安全与合规 - ${SITE_NAME}`,
    description:
      'SynTools 安全说明：纯静态、无上传接口、CSP 限制出站请求为同源、无第三方脚本与追踪、源码公开可离线审计。含依赖许可清单与采购常见问题，可直接用于技术评审。',
    sections: [
      {
        heading: '数据在哪里处理',
        items: [
          '网页版没有上传接口，文件在浏览器内存中由 Canvas / WebAssembly / JavaScript 处理',
          '处理文件期间不产生任何出站请求，可在开发者工具 Network 面板验证',
        ],
      },
      {
        heading: '内容安全策略限制了哪些能力',
        items: [
          "default-src 'self'：只允许加载本站资源",
          "connect-src 'self'：网络请求只能回本站，第三方统计脚本无法工作",
          "script-src 'self' 'wasm-unsafe-eval'：禁止内联脚本与 CDN 脚本",
          'frame-ancestors none：不允许被任何站点用 iframe 嵌套',
        ],
      },
      {
        heading: '可自行审计',
        items: [
          '源码以 AGPL-3.0 公开，可克隆、审阅、离线构建',
          '依赖锁定在 pnpm-lock.yaml，可生成 SBOM 核对版本与哈希',
          '核心依赖为 MIT / Apache-2.0 / MPL-2.0，无 GPL 传染性依赖',
        ],
      },
    ],
  },
  {
    path: '/privacy/',
    title: `隐私说明 - ${SITE_NAME}`,
    description:
      'SynTools 隐私说明：不收集文件内容、不需要账号、不使用追踪 Cookie、不加载第三方脚本。本机只保存界面设置、收藏与草稿；统计埋点默认关闭且不含任何输入内容。',
    sections: [
      {
        heading: '你的文件',
        items: ['不会被上传：没有上传接口，处理结果在本机生成', '文件名、内容与结果不进入任何日志'],
      },
      {
        heading: '本机存储与统计',
        items: [
          'localStorage 只保存界面设置、收藏与最近使用、未保存草稿',
          '统计埋点默认关闭；启用后只上报事件名、工具 id、耗时与界面语言',
          '不使用 Cookie，不做设备指纹，DNT / GPC 生效时停止采集',
        ],
      },
    ],
  },
  {
    path: '/about/',
    title: `关于 ${SITE_NAME}`,
    description:
      'SynTools 是一个纯前端的在线工具集：编码格式化、图片与照片编辑、PDF 处理、Word/Excel/PPT 浏览器编辑等，全部在本机运行，文件不上传。源码以 AGPL-3.0 公开，另提供商业许可。',
    sections: [
      {
        heading: '这是什么',
        items: [
          '把日常零碎工具收拢到一个入口，统一搜索、收藏与最近使用',
          '网页版为纯静态站点；桌面社区版与专业版是同一套界面的离线形态；服务器版把同一份构建产物部署到自有机器或内网',
        ],
      },
      {
        heading: '许可',
        items: [
          'AGPL-3.0-only 开源，可自由使用、修改与自建',
          '闭源或内网场景可选择商业许可，免除 AGPL 义务',
        ],
      },
    ],
  },
];

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

interface MetaOpts {
  title: string;
  description: string;
  siteUrl: string | null;
  path: string;
  /** 相对站点的 OG 图路径；不存在则回退品牌默认图，都没有则省略 */
  ogImage: string | null;
}

/** 站点通用 meta 标签（注入到 </head> 前） */
function buildMetaTags(opts: MetaOpts): string {
  const { title, description, siteUrl, path, ogImage } = opts;
  const absolute = (p: string): string => (siteUrl ? siteUrl + p : p);
  const tags = [
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<meta name="application-name" content="${BRAND}" />`,
    `<meta property="og:site_name" content="${BRAND}" />`,
    `<meta property="og:locale" content="zh_CN" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    '<meta property="og:type" content="website" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
  ];
  if (siteUrl) {
    tags.push(`<meta property="og:url" content="${escapeAttr(absolute(path))}" />`);
    tags.push(`<link rel="canonical" href="${escapeAttr(absolute(path))}" />`);
  }
  if (ogImage) {
    const url = escapeAttr(absolute(ogImage));
    tags.push(`<meta property="og:image" content="${url}" />`);
    tags.push(`<meta property="og:image:width" content="1200" />`);
    tags.push(`<meta property="og:image:height" content="630" />`);
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
}): string {
  const { siteUrl, path, name, description, category } = opts;
  const url = siteUrl ? siteUrl + path : path;
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
        inLanguage: 'zh-CN',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
        ...(siteUrl ? { publisher: { '@type': 'Organization', name: BRAND, url: siteUrl } } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: BRAND, item: siteUrl ? `${siteUrl}/` : '/' },
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

function buildSitemap(siteUrl: string, paths: string[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = paths
    .map(
      (p) =>
        `  <url>\n    <loc>${escapeAttr(siteUrl + p)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

type PrerenderTool = Pick<
  ToolMeta,
  'id' | 'name' | 'description' | 'category' | 'weight' | 'relatedIds'
>;

/** 经编程式 dev server 的 SSR 管线加载注册表（解析 @/ 别名） */
async function loadTools(root: string): Promise<PrerenderTool[]> {
  const server = await createServer({
    configFile: false,
    root,
    resolve: { alias: { '@': resolvePath(root, 'src') } },
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
    logLevel: 'silent',
  });
  try {
    const mod = (await server.ssrLoadModule('@/core/registry')) as { tools: PrerenderTool[] };
    return mod.tools;
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

      let tools: PrerenderTool[];
      try {
        tools = await loadTools(root);
      } catch (err) {
        console.warn('[prerender] 加载注册表失败，跳过预渲染：', err);
        return;
      }

      const ogFiles = await readOgImages(distDir);
      const hasDefaultOg = ogFiles.has('default.png');

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
            ogImage: opts.ogImage,
          }),
          opts.jsonLd ?? '',
          `<style>${SHELL_STYLE}</style>`,
        ]
          .filter(Boolean)
          .join('\n    ');
        return template
          .replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(opts.title)}</title>`)
          .replace('</head>', `    ${head}\n  </head>`)
          .replace('<div id="root"></div>', `<div id="root">${buildShell(opts.bodyHtml)}</div>`);
      };

      const defaultOg = hasDefaultOg ? '/og/default.png' : null;

      // 首页：注入站点级 meta + 全量分类内链（153 条工具链接，给爬虫一张完整地图）
      const homeNav = buildHomeBody(tools);
      await writeFile(
        indexPath,
        render({
          title: SITE_NAME,
          description: SITE_DESCRIPTION,
          path: '/',
          bodyHtml: homeNav,
          ogImage: defaultOg,
        }),
        'utf-8',
      );

      // 工具页：/tools/<id>/index.html（静态托管优先于 SPA fallback 命中）
      for (const tool of tools) {
        const title = `${tool.name} - ${SITE_NAME}`;
        const description = `${tool.description}。纯前端处理，数据不离开浏览器。`;
        const path = `/tools/${tool.id}/`;
        const og = ogFiles.has(`${tool.id}.png`) ? `/og/${tool.id}.png` : defaultOg;
        const body = buildToolBody(tool, relatedOf(tool));
        const file = resolvePath(distDir, 'tools', tool.id, 'index.html');
        await mkdir(dirname(file), { recursive: true });
        await writeFile(
          file,
          render({
            title,
            description,
            path,
            bodyHtml: body,
            ogImage: og,
            jsonLd: buildToolJsonLd({
              siteUrl,
              path,
              name: tool.name,
              description: tool.description,
              category: tool.category,
            }),
          }),
          'utf-8',
        );
      }

      // 静态页：/download/ /pricing/ /security/ /privacy/ /about/
      for (const page of STATIC_PAGES) {
        const file = resolvePath(distDir, `${page.path.replace(/^\/+|\/+$/g, '')}/index.html`);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(
          file,
          render({
            title: page.title,
            description: page.description,
            path: page.path,
            bodyHtml: buildStaticBody(page, tools.length),
            ogImage: defaultOg,
          }),
          'utf-8',
        );
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

      // sitemap.xml
      const paths = [
        '/',
        ...STATIC_PAGES.map((page) => page.path),
        ...tools.map((tool) => `/tools/${tool.id}/`),
      ];
      await writeFile(resolvePath(distDir, 'sitemap.xml'), buildSitemap(siteUrl, paths), 'utf-8');

      // GitHub Pages：无服务端 SPA fallback，用 404.html 回退到应用壳
      await writeFile(
        resolvePath(distDir, '404.html'),
        await readFile(indexPath, 'utf-8'),
        'utf-8',
      );
      // 禁止 Jekyll 处理，保留 _headers 等以下划线开头的文件
      await writeFile(resolvePath(distDir, '.nojekyll'), '', 'utf-8');

      console.log(
        `预渲染完成：首页 + ${tools.length} 个工具页 + ${STATIC_PAGES.length} 个静态页 + robots.txt + sitemap.xml（${paths.length} 条）+ 404.html`,
      );
    },
  };
}

/** 首页正文骨架：按分类列出全部工具，形成可抓取的站内链接图 */
function buildHomeBody(tools: PrerenderTool[]): string {
  const byCategory = new Map<string, PrerenderTool[]>();
  for (const tool of tools) {
    const list = byCategory.get(tool.category) ?? [];
    list.push(tool);
    byCategory.set(tool.category, list);
  }
  const sections = [...byCategory.entries()]
    .map(([category, list]) => {
      const items = list
        .map((tool) => `<li><a href="/tools/${tool.id}/">${escapeText(tool.name)}</a></li>`)
        .join('');
      return `<h2>${escapeText(CATEGORY_LABELS[category] ?? category)}</h2><ul>${items}</ul>`;
    })
    .join('');
  return [
    `<h1>${escapeText(BRAND)} 在线工具集</h1>`,
    `<p class="seo-lead">${escapeText(SITE_DESCRIPTION)}</p>`,
    sections,
    `<p class="seo-note">以上全部工具默认在浏览器本地计算，文件与文本不会上传到服务器。可另下载桌面版，完全离线使用。</p>`,
  ].join('');
}

/** 静态页正文骨架：标题 + 一句话说明 + 小节 + 站内互链 */
function buildStaticBody(page: StaticPage, toolCount: number): string {
  const sections = (page.sections ?? [])
    .map(
      (section) =>
        `<h2>${escapeText(section.heading)}</h2><ul>${section.items
          .map((item) => `<li>${escapeText(item)}</li>`)
          .join('')}</ul>`,
    )
    .join('');
  return [
    `<h1>${escapeText(page.title.split(' - ')[0]!)}</h1>`,
    `<p class="seo-lead">${escapeText(page.description)}</p>`,
    sections,
    `<p class="seo-note">${escapeText(BRAND)} 的全部工具默认在浏览器本地计算，文件与文本不会上传到服务器。</p>`,
    `<p>${STATIC_PAGES.filter((p) => p.path !== page.path)
      .map((p) => `<a href="${p.path}">${escapeText(p.title.split(' - ')[0]!)}</a>`)
      .join(' · ')} · <a href="/">全部 ${toolCount} 个工具</a></p>`,
  ].join('');
}

/** 工具页正文骨架：说明 + 同分类内链 + 返回入口 */ function buildToolBody(
  tool: PrerenderTool,
  related: PrerenderTool[],
): string {
  const relatedHtml = related.length
    ? `<h2>同类工具</h2><ul>${related
        .map((t) => `<li><a href="/tools/${t.id}/">${escapeText(t.name)}</a></li>`)
        .join('')}</ul>`
    : '';
  return [
    `<h1>${escapeText(tool.name)}</h1>`,
    `<p class="seo-lead">${escapeText(tool.description)}</p>`,
    `<p class="seo-note">本工具默认在浏览器内本地计算，输入内容不会上传到服务器。若需要离线使用，可下载桌面版。</p>`,
    relatedHtml,
    `<p><a href="/">全部工具</a> · <a href="/download/">下载桌面版</a></p>`,
  ].join('');
}

/** 分类中文名（与 src/core/registry/categories.ts 保持一致；仅用于静态内链标题） */
const CATEGORY_LABELS: Record<string, string> = {
  advanced: '文档与创作',
  encoding: '编码转换',
  text: '文本处理',
  formatting: '格式化',
  crypto: '加密哈希',
  datetime: '时间日期',
  generator: '生成器',
  network: '网络',
  image: '图片处理',
  pdf: 'PDF 工具',
  other: '其他',
  file: '文件工具',
  media: '音视频',
  cheatsheet: '速查表',
};
