// 类型从 vitest/config 导入（其 re-export 的 vite 类型与 defineConfig 同一副本，
// 避免 vitest 内嵌 vite5 与顶层 vite6 的 Plugin 类型冲突）
import type { Plugin } from 'vitest/config';
import type { ToolMeta } from '../src/core/types';
import { createServer } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve as resolvePath } from 'node:path';

/**
 * SEO 预渲染插件（Tasks T31）：构建结束后为首页与每个工具页生成含
 * title / meta description / Open Graph 的静态 HTML，并输出 robots.txt
 * 与 sitemap.xml（后者需设置 SITE_URL 环境变量，如 https://syntools.dev）。
 *
 * 说明：
 * - 在 closeBundle 阶段（产物已落盘）读取 dist/index.html 作为模板；
 * - 工具元数据经编程式 createServer + ssrLoadModule 从注册表读取（走 Vite
 *   模块管线，自动解析整条依赖链上的 `@/` 别名；build 环境的插件上下文不提供
 *   ssrLoadModule，vite.config.ts 又被 esbuild 打包无法静态 import 别名模块）。
 *   注册表链上只有 type-only 导入与不执行的懒加载工厂，SSR 加载安全；
 * - Cloudflare Pages / Vercel 均优先返回真实静态文件，SPA fallback 不受影响。
 */

/** HTML 属性值转义（工具名/描述可能含 & " < > 等字符） */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 站点通用 meta 标签（注入到 </head> 前） */
function buildMetaTags(opts: {
  title: string;
  description: string;
  siteUrl: string | null;
  path: string;
}): string {
  const { title, description, siteUrl, path } = opts;
  const tags = [
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    '<meta property="og:type" content="website" />',
  ];
  if (siteUrl) {
    tags.push(`<meta property="og:url" content="${escapeAttr(siteUrl + path)}" />`);
    tags.push(`<link rel="canonical" href="${escapeAttr(siteUrl + path)}" />`);
  }
  return tags.join('\n    ');
}

function buildSitemap(siteUrl: string, paths: string[]): string {
  const urls = paths
    .map(
      (p) =>
        `  <url>\n    <loc>${escapeAttr(siteUrl + p)}</loc>\n    <changefreq>weekly</changefreq>\n  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const SITE_NAME = 'SynTools - 开发者在线工具集';
const SITE_DESCRIPTION =
  'SynTools 是免费的开发者在线工具集：JSON 格式化、Base64/URL 编解码、正则测试、文本对比、时间戳转换、UUID/密码生成、哈希计算、二维码、颜色与进制转换、Markdown 预览、图片压缩等，纯前端处理，数据不离开浏览器。';

/** 经编程式 dev server 的 SSR 管线加载注册表（解析 @/ 别名） */
async function loadTools(root: string): Promise<Pick<ToolMeta, 'id' | 'name' | 'description'>[]> {
  const server = await createServer({
    configFile: false,
    root,
    resolve: { alias: { '@': resolvePath(root, 'src') } },
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
    logLevel: 'silent',
  });
  try {
    const mod = (await server.ssrLoadModule('@/core/registry')) as {
      tools: Pick<ToolMeta, 'id' | 'name' | 'description'>[];
    };
    return mod.tools;
  } finally {
    await server.close();
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
      const siteUrl = process.env.SITE_URL?.replace(/\/+$/, '') || null;
      const distDir = resolvePath(root, outDir);
      const indexPath = resolvePath(distDir, 'index.html');

      let template: string;
      try {
        template = await readFile(indexPath, 'utf-8');
      } catch {
        console.warn('[prerender] 未找到 dist/index.html，跳过预渲染');
        return;
      }

      let tools: Pick<ToolMeta, 'id' | 'name' | 'description'>[];
      try {
        tools = await loadTools(root);
      } catch (err) {
        console.warn('[prerender] 加载注册表失败，跳过预渲染：', err);
        return;
      }

      const render = (title: string, description: string, path: string): string =>
        template
          .replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(title)}</title>`)
          .replace(
            '</head>',
            `    ${buildMetaTags({ title, description, siteUrl, path })}\n  </head>`,
          );

      // 首页：注入站点级 meta（title 与模板一致）
      await writeFile(indexPath, render(SITE_NAME, SITE_DESCRIPTION, '/'), 'utf-8');

      // 工具页：/tools/<id>/index.html（静态托管优先于 SPA fallback 命中）
      for (const tool of tools) {
        const title = `${tool.name} - ${SITE_NAME}`;
        const description = `${tool.description}。纯前端处理，数据不离开浏览器。`;
        const file = resolvePath(distDir, 'tools', tool.id, 'index.html');
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, render(title, description, `/tools/${tool.id}/`), 'utf-8');
      }

      // robots.txt（SITE_URL 存在时附带 sitemap 声明）
      const robots = ['User-agent: *', 'Allow: /'];
      if (siteUrl) robots.push(`Sitemap: ${siteUrl}/sitemap.xml`);
      await writeFile(resolvePath(distDir, 'robots.txt'), `${robots.join('\n')}\n`, 'utf-8');

      // sitemap.xml（仅在配置了 SITE_URL 时生成）
      if (siteUrl) {
        const paths = ['/', ...tools.map((tool) => `/tools/${tool.id}/`)];
        await writeFile(resolvePath(distDir, 'sitemap.xml'), buildSitemap(siteUrl, paths), 'utf-8');
      }

      console.log(
        `预渲染完成：首页 + ${tools.length} 个工具页 + robots.txt${siteUrl ? ' + sitemap.xml' : ''}`,
      );
    },
  };
}
