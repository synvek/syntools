#!/usr/bin/env node
/**
 * Open Graph 分享图生成器（1200×630 PNG）。
 *
 * 这张图只出现在**链接被分享出去时**的预览卡片里（微信、飞书、X、Telegram、
 * Slack、Discord、LinkedIn…），站内任何页面都不会显示它。因此它的唯一任务是
 * 「三秒内让人知道这是什么 + 记住品牌」，正文信息由平台自己渲染的
 * og:title / og:description 承担，不需要在图里重复一遍。
 *
 * 为什么用本机 Chrome 而不是新依赖：OG 图只是静态图，用无头浏览器截一张
 * HTML 卡片即可，不必为一次性产物引入 canvas / resvg 之类的原生依赖。
 *
 * 用法：
 *   node scripts/gen-og.mjs                 # 中文默认图 public/og/default.png
 *   node scripts/gen-og.mjs --lang=en       # 英文版 public/og/default.en.png
 *   node scripts/gen-og.mjs --all           # 顺带为每个工具生成 public/og/<id>.png
 *   CHROME_PATH=/path/to/chrome node scripts/gen-og.mjs
 *
 * 说明：
 * - 预渲染脚本（scripts/prerender.ts）会优先使用 /og/<toolId>.png，
 *   缺失时回退 /og/default.png，所以只跑默认图也能让全站分享卡片生效。
 * - 生成的图需要提交进仓库，构建时不再重复执行（CI 上通常没有 Chrome）。
 * - 全站所有语种共用一个 URL，因此 og:image 只能是一张图、一种语言；
 *   选语言的依据是「主要投放渠道」，不是「站点默认语言」。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'og');
const SITE = 'www.syntools.net';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

function findChrome() {
  const hit = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!hit) {
    throw new Error(
      '未找到 Chromium 内核浏览器。请用 CHROME_PATH=/path/to/chrome 指定，或改用 pnpm exec playwright install chromium 后设置该路径。',
    );
  }
  return hit;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 文案表：新增语种只需在这里加一项 */
const COPY = {
  zh: {
    title: '在线工具集',
    // 数量交给右上角胶囊，这里不要再重复，否则一眼看到两个「153」
    subtitle: () => '打开即用，文件不出浏览器',
    badge: (n) => `${n} 个工具`,
    foot: '纯前端本地计算',
    toolBadge: '免费 · 无需上传',
    lang: 'zh-CN',
  },
  en: {
    title: '153 tools in one place',
    // 控制在 60 字符内，否则 28px 字号会被折成两行
    subtitle: () => `Documents, PDF, images, encoding — all running in your browser.`,
    badge: (n) => `${n} tools`,
    foot: '100% client-side · your files never leave the device',
    toolBadge: 'Free · No upload',
    lang: 'en',
  },
};

const LOGO_TILE = `<svg width="38" height="38" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M43 17c-6.5-4.8-19-4.2-19 6.2 0 3.2 1.8 5.4 5.2 7.2" stroke="#fff" stroke-width="5.75" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M42.5 35.2c4.2 2 6.5 4.8 6.5 9.2 0 9.8-13 13-21.8 8.2" stroke="#fff" stroke-width="5.75" stroke-linecap="round" stroke-linejoin="round"/>
  <path fill="#fff" d="M38 20.5 27 33.8h7.4L29.2 46l14-15.6h-7.6L38 20.5Z"/>
</svg>`;

const glyph = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

/** 语言无关的工具类目图标：一眼看出「这里有一堆工具」 */
const GLYPHS = [
  glyph(
    '<path d="M9 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2"/><path d="M15 3h2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2"/>',
  ),
  glyph('<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>'),
  glyph(
    '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/>',
  ),
  glyph(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  ),
  glyph('<circle cx="12" cy="12" r="9"/><path d="M10 8.5 16 12l-6 3.5z"/>'),
  glyph(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>',
  ),
  glyph(
    '<circle cx="12" cy="12" r="9"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/><path d="M3 12h18"/>',
  ),
  glyph('<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>'),
];

/**
 * 卡片 HTML：尺寸固定 1200×630，不依赖任何外部资源。
 * 注意：背景网格用覆盖式渐变收边，不要用 mask-image ——
 * 无头 Chrome 截图上会留下合成层残影（实测出现过硬边色块）。
 */
function cardHtml({ title, subtitle, badge, foot, lang, iconStrip = true }) {
  const safeTitle = escapeHtml(title);
  // 标题过长时缩小字号，避免溢出到卡片外
  const cjk = /[\u4e00-\u9fa5]/.test(safeTitle);
  const size = cjk
    ? safeTitle.length > 8
      ? 76
      : 104
    : safeTitle.length > 26
      ? 62
      : safeTitle.length > 16
        ? 82
        : 96;
  return `<!doctype html>
<html lang="${escapeHtml(lang)}"><head><meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #0a1020;
    color: #f8fafc;
    position: relative;
    overflow: hidden;
  }
  .glow {
    position: absolute; width: 900px; height: 900px; left: -220px; top: -380px;
    background: radial-gradient(circle, rgba(59,130,246,.55) 0%, rgba(59,130,246,.12) 42%, transparent 68%);
  }
  .glow2 {
    position: absolute; width: 760px; height: 760px; right: -260px; bottom: -340px;
    background: radial-gradient(circle, rgba(29,78,216,.45) 0%, rgba(29,78,216,.10) 45%, transparent 70%);
  }
  .grid-bg {
    position: absolute; inset: 0; opacity: .16;
    background-image: linear-gradient(rgba(148,163,184,.35) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(148,163,184,.35) 1px, transparent 1px);
    background-size: 60px 60px;
  }
  .fade {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at 30% 20%, transparent 0%, transparent 55%, #0a1020 92%);
  }
  .wrap { position: relative; height: 100%; padding: 56px 68px; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 18px; }
  .tile-logo {
    width: 60px; height: 60px; border-radius: 15px;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 10px 30px rgba(37,99,235,.45);
  }
  .brand-name { font-size: 29px; font-weight: 700; letter-spacing: .01em; }
  .badge {
    margin-left: auto; font-size: 19px; font-weight: 600; color: #93c5fd;
    border: 1px solid rgba(147,197,253,.42); border-radius: 999px; padding: 9px 20px;
    background: rgba(37,99,235,.14);
  }
  .main { margin-top: auto; }
  h1 { font-size: ${size}px; line-height: 1.08; font-weight: 800; letter-spacing: -.025em; }
  .sub { margin-top: 24px; font-size: 28px; line-height: 1.45; color: #a8b6cc; max-width: 980px; }
  .strip { margin-top: 34px; display: flex; gap: 14px; color: #4b6a94; }
  .strip div {
    width: 62px; height: 62px; border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(148,163,184,.06); border: 1px solid rgba(148,163,184,.14);
  }
  .strip svg { width: 32px; height: 32px; }
  .foot {
    margin-top: 30px; display: flex; align-items: center; gap: 14px;
    font-size: 21px; color: #7d8ba1; font-weight: 500;
  }
  .dot { width: 7px; height: 7px; border-radius: 999px; background: #22c55e; flex: none; }
  .site { margin-left: auto; color: #64748b; }
</style></head>
<body>
  <div class="glow"></div><div class="glow2"></div><div class="grid-bg"></div><div class="fade"></div>
  <div class="wrap">
    <div class="brand">
      <div class="tile-logo">${LOGO_TILE}</div>
      <div class="brand-name">SynTools</div>
      <div class="badge">${escapeHtml(badge)}</div>
    </div>
    <div class="main">
      <h1>${safeTitle}</h1>
      <div class="sub">${escapeHtml(subtitle)}</div>
      ${iconStrip ? `<div class="strip">${GLYPHS.map((g) => `<div>${g}</div>`).join('')}</div>` : ''}
      <div class="foot">
        <span class="dot"></span>
        <span>${escapeHtml(foot)}</span>
        <span class="site">${SITE}</span>
      </div>
    </div>
  </div>
</body></html>`;
}

function shoot(chrome, html, outFile) {
  const tmp = path.join(tmpdir(), `syntools-og-${process.pid}.html`);
  // 独立 profile：避免与本机已开的 Chrome 争抢默认 profile 锁
  const profile = path.join(tmpdir(), `syntools-og-profile-${process.pid}`);
  writeFileSync(tmp, html, 'utf-8');
  try {
    execFileSync(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--hide-scrollbars',
        `--user-data-dir=${profile}`,
        '--force-device-scale-factor=1',
        '--window-size=1200,630',
        // 太短会让渐变层来不及合成，留下色块
        '--virtual-time-budget=3000',
        `--screenshot=${outFile}`,
        `file://${tmp}`,
      ],
      { stdio: 'pipe' },
    );
  } finally {
    rmSync(tmp, { force: true });
    rmSync(profile, { recursive: true, force: true });
  }
}

/** 经 Vite SSR 管线读取注册表（与 prerender 同一套做法，无需手抄工具清单） */
async function loadTools() {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: false,
    root: ROOT,
    resolve: { alias: { '@': path.join(ROOT, 'src') } },
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
    logLevel: 'silent',
  });
  try {
    const mod = await server.ssrLoadModule('@/core/registry');
    return mod.tools;
  } finally {
    await server.close();
  }
}

async function main() {
  const chrome = findChrome();
  mkdirSync(OUT_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const langArg = args.find((a) => a.startsWith('--lang='))?.split('=')[1];
  const lang = langArg && COPY[langArg] ? langArg : 'zh';
  const copy = COPY[lang];
  const withAll = args.includes('--all');
  const tools = withAll ? await loadTools() : [];
  const count = tools.length || 153;

  const outFile = path.join(OUT_DIR, lang === 'zh' ? 'default.png' : `default.${lang}.png`);
  shoot(
    chrome,
    cardHtml({
      title: copy.title,
      subtitle: copy.subtitle(count),
      badge: copy.badge(count),
      foot: copy.foot,
      lang: copy.lang,
    }),
    outFile,
  );
  console.log(`✓ ${path.relative(ROOT, outFile)}  (${lang})`);

  if (withAll) {
    for (const tool of tools) {
      shoot(
        chrome,
        cardHtml({
          title: tool.name,
          subtitle: tool.description,
          badge: copy.toolBadge,
          foot: copy.foot,
          lang: copy.lang,
          iconStrip: false,
        }),
        path.join(OUT_DIR, `${tool.id}.png`),
      );
    }
    console.log(`✓ 已生成 ${tools.length} 张工具分享图（语言：${lang}）`);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
