#!/usr/bin/env node
/**
 * 线上 SEO / 可达性自检（部署后跑一次）。
 *
 *   pnpm check:seo
 *   SITE_URL=https://staging.example.com pnpm check:seo
 *
 * 覆盖的是「部署后最容易被悄悄弄坏、而且坏了不会报错」的那几项：
 * robots.txt 是否被托管商改写、sitemap 主机是否一致、深链是否仍返回
 * 预渲染正文、canonical 是否唯一、og:image 是否真的取得到、
 * apex 是否 301 到主域且**保留了路径**。
 *
 * 退出码：全部通过为 0，有失败为 1（可直接接进 CI）。
 */
import process from 'node:process';

const SITE = (process.env.SITE_URL || 'https://www.syntools.net').replace(/\/$/, '');
const APEX = (process.env.APEX_URL || 'https://syntools.net').replace(/\/$/, '');
const SAMPLE_TOOL = 'tools/json-format/';
const TIMEOUT = 20000;

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
}

async function get(url, { redirect = 'follow' } = {}) {
  const res = await fetch(url, {
    redirect,
    headers: {
      // 部分 CDN 对无 UA 的请求会返回 403，伪装成普通浏览器
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'accept-language': 'zh-CN,zh;q=0.9',
    },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const body = redirect === 'manual' ? '' : await res.text();
  return { status: res.status, headers: res.headers, body };
}

/** 包一层，把网络异常也变成一条可读的失败项，而不是让脚本崩掉 */
async function check(name, fn) {
  try {
    await fn();
  } catch (err) {
    // fetch 的失败原因藏在 cause 里，直接打 err.message 只会看到 "fetch failed"
    const code = err.cause?.code || err.code;
    const hint =
      code === 'ENOTFOUND' || code === 'EAI_AGAIN'
        ? 'DNS 解析失败（可能是本机 DNS 缓存，或该域名尚未配置解析）'
        : code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT'
          ? '连接超时'
          : err.message;
    record(name, false, `请求失败：${hint}${code ? `［${code}］` : ''}`);
  }
}

async function main() {
  const stamp = `?cb=${Date.now()}`;

  // 1. robots.txt —— 托管商（Cloudflare 等）可能注入自己的内容
  await check('robots.txt 可访问且未被托管商注入', async () => {
    const { status, body } = await get(`${SITE}/robots.txt${stamp}`);
    const disallow = (body.match(/^\s*disallow\s*:/gim) || []).length;
    const injected = /BEGIN\s+Cloudflare\s+Managed/i.test(body);
    const ok = status === 200 && disallow === 0 && !injected;
    record(
      'robots.txt 可访问且未被托管商注入',
      ok,
      `HTTP ${status}｜Disallow ${disallow} 条｜注入块 ${injected ? '存在' : '无'}`,
    );
  });

  // 2. robots.txt 里必须声明 sitemap，否则只能靠手动提交
  await check('robots.txt 声明 Sitemap', async () => {
    const { body } = await get(`${SITE}/robots.txt${stamp}`);
    const m = body.match(/^\s*sitemap\s*:\s*(\S+)/im);
    record('robots.txt 声明 Sitemap', Boolean(m), m ? m[1] : '缺少 Sitemap 行');
  });

  // 3. sitemap 主机一致性 —— 写错主机会让 GSC 报「属于其他主机」
  await check('sitemap 可访问且主机一致', async () => {
    const { status, body } = await get(`${SITE}/sitemap.xml${stamp}`);
    const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const foreign = locs.filter((u) => !u.startsWith(`${SITE}/`) && u !== SITE);
    const ok = status === 200 && locs.length > 0 && foreign.length === 0;
    record(
      'sitemap 可访问且主机一致',
      ok,
      `HTTP ${status}｜${locs.length} 条｜非本站主机 ${foreign.length} 条${foreign[0] ? `（如 ${foreign[0]}）` : ''}`,
    );
  });

  // 4. 首页有预渲染正文（不是空 #root）
  await check('首页含静态正文与 canonical', async () => {
    const { status, body } = await get(`${SITE}/${stamp}`);
    const hasH1 = /<h1[\s>]/i.test(body);
    const hasCanonical = /rel="canonical"/i.test(body);
    record(
      '首页含静态正文与 canonical',
      status === 200 && hasH1 && hasCanonical,
      `HTTP ${status}｜h1 ${hasH1 ? '有' : '无'}｜canonical ${hasCanonical ? '有' : '无'}`,
    );
  });

  // 5. 工具深链：正文 + canonical + og:image + 无 noindex
  await check('工具页深链完整', async () => {
    const { status, body } = await get(`${SITE}/${SAMPLE_TOOL}${stamp}`);
    const hasH1 = /<h1[\s>]/i.test(body);
    const canonical = body.match(/rel="canonical"\s+href="([^"]+)"/i)?.[1];
    const ogImage = body.match(/property="og:image"\s+content="([^"]+)"/i)?.[1];
    const noindex = /content="[^"]*noindex/i.test(body);
    const canonicalOk = canonical === `${SITE}/${SAMPLE_TOOL}`;
    record(
      `工具页深链完整（/${SAMPLE_TOOL}）`,
      status === 200 && hasH1 && canonicalOk && Boolean(ogImage) && !noindex,
      `HTTP ${status}｜h1 ${hasH1 ? '有' : '无'}｜canonical ${canonicalOk ? '正确' : `异常(${canonical})`}｜og:image ${ogImage ? '有' : '无'}｜noindex ${noindex ? '有' : '无'}`,
    );

    // 6. og:image 必须真的能取到，否则分享卡片是空白
    if (ogImage) {
      const img = await get(ogImage);
      const type = img.headers.get('content-type') || '';
      record(
        'og:image 可访问',
        img.status === 200 && type.startsWith('image/'),
        `HTTP ${img.status}｜${type}`,
      );
    } else {
      record('og:image 可访问', false, '页面未声明 og:image');
    }
  });

  // 7. 下载页（桌面端收入入口）
  await check('下载页可访问', async () => {
    const { status, body } = await get(`${SITE}/download/${stamp}`);
    record(
      '下载页可访问',
      status === 200 && /<h1[\s>]/i.test(body),
      `HTTP ${status}｜h1 ${/<h1[\s>]/i.test(body) ? '有' : '无'}`,
    );
  });

  // 8. apex 首页 301 到主域
  await check('apex 301 到主域', async () => {
    const { status, headers } = await get(`${APEX}/${stamp}`, { redirect: 'manual' });
    const loc = headers.get('location') || '';
    record(
      'apex 301 到主域',
      status === 301 && loc.replace(/\?.*$/, '') === `${SITE}/`,
      `HTTP ${status}｜location ${loc}`,
    );
  });

  // 9. apex 深链必须保留路径与查询串 —— 丢了就等于把权重全堆到首页
  await check('apex 深链保留路径与参数', async () => {
    const path = '/tools/json-format/?a=1&b=2';
    const { status, headers } = await get(`${APEX}${path}`, { redirect: 'manual' });
    const loc = headers.get('location') || '';
    const expect = `${SITE}/tools/json-format/?a=1&b=2`;
    record(
      'apex 深链保留路径与参数',
      status === 301 && loc === expect,
      `HTTP ${status}｜期望 ${expect}｜实际 ${loc}`,
    );
  });

  // 10. http 必须一跳直达 https 主域，不能中间再跳一次
  await check('http 一跳直达 https 主域', async () => {
    const httpApex = APEX.replace(/^https:/, 'http:');
    const { status, headers } = await get(`${httpApex}/tools/base64/`, { redirect: 'manual' });
    const loc = headers.get('location') || '';
    const ok = status === 301 && loc === `${SITE}/tools/base64/`;
    record('http 一跳直达 https 主域', ok, `HTTP ${status}｜location ${loc}`);
  });

  // ---- 输出 ----
  const pad = Math.max(...results.map((r) => r.name.length)) + 2;
  let failed = 0;
  console.log(`\n站点：${SITE}    apex：${APEX}\n`);
  for (const r of results) {
    if (!r.ok) failed += 1;
    console.log(`${r.ok ? '✓' : '✗'} ${r.name.padEnd(pad)}${r.detail}`);
  }
  console.log(`\n${results.length - failed}/${results.length} 通过\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
