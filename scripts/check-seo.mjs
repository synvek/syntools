#!/usr/bin/env node
/**
 * Live SEO / reachability self-check (run once after deploying).
 *
 *   pnpm check:seo
 *   SITE_URL=https://staging.example.com pnpm check:seo
 *
 * It covers the things that break silently after a deploy without raising errors:
 * whether robots.txt was rewritten by the host, whether the sitemap host matches,
 * whether deep links still return prerendered content, whether canonical is unique,
 * whether og:image really resolves, and whether the apex 301s to the main domain
 * **keeping the path**.
 *
 * Exit code: 0 when everything passes, 1 on failures (usable directly in CI).
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
      // Some CDNs return 403 for requests without a UA, so pretend to be a regular browser
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'accept-language': 'zh-CN,zh;q=0.9',
    },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const body = redirect === 'manual' ? '' : await res.text();
  return { status: res.status, headers: res.headers, body };
}

/** Wraps a check so network errors become a readable failure instead of crashing the script */
async function check(name, fn) {
  try {
    await fn();
  } catch (err) {
    // fetch hides the real cause in `cause`; printing err.message only shows "fetch failed"
    const code = err.cause?.code || err.code;
    const hint =
      code === 'ENOTFOUND' || code === 'EAI_AGAIN'
        ? 'DNS resolution failed (local DNS cache, or the domain has no record yet)'
        : code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT'
          ? 'connection timed out'
          : err.message;
    record(name, false, `request failed: ${hint}${code ? ` [${code}]` : ''}`);
  }
}

async function main() {
  const stamp = `?cb=${Date.now()}`;

  // 1. robots.txt — hosts (Cloudflare etc.) may inject their own content
  await check('robots.txt reachable and not injected by the host', async () => {
    const { status, body } = await get(`${SITE}/robots.txt${stamp}`);
    const disallow = (body.match(/^\s*disallow\s*:/gim) || []).length;
    const injected = /BEGIN\s+Cloudflare\s+Managed/i.test(body);
    const ok = status === 200 && disallow === 0 && !injected;
    record(
      'robots.txt reachable and not injected by the host',
      ok,
      `HTTP ${status} | Disallow rules ${disallow} | injected block ${injected ? 'present' : 'none'}`,
    );
  });

  // 2. robots.txt must declare the sitemap, otherwise only manual submission works
  await check('robots.txt declares a Sitemap', async () => {
    const { body } = await get(`${SITE}/robots.txt${stamp}`);
    const m = body.match(/^\s*sitemap\s*:\s*(\S+)/im);
    record('robots.txt declares a Sitemap', Boolean(m), m ? m[1] : 'Sitemap line missing');
  });

  // 3. Sitemap host consistency — a wrong host makes GSC report "belongs to another host"
  await check('sitemap reachable and host matches', async () => {
    const { status, body } = await get(`${SITE}/sitemap.xml${stamp}`);
    const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const foreign = locs.filter((u) => !u.startsWith(`${SITE}/`) && u !== SITE);
    const ok = status === 200 && locs.length > 0 && foreign.length === 0;
    record(
      'sitemap reachable and host matches',
      ok,
      `HTTP ${status} | ${locs.length} entries | foreign hosts ${foreign.length}${foreign[0] ? ` (e.g. ${foreign[0]})` : ''}`,
    );
  });

  // 4. The home page has prerendered content (not an empty #root)
  await check('home page has static content and canonical', async () => {
    const { status, body } = await get(`${SITE}/${stamp}`);
    const hasH1 = /<h1[\s>]/i.test(body);
    const hasCanonical = /rel="canonical"/i.test(body);
    record(
      'home page has static content and canonical',
      status === 200 && hasH1 && hasCanonical,
      `HTTP ${status} | h1 ${hasH1 ? 'yes' : 'no'} | canonical ${hasCanonical ? 'yes' : 'no'}`,
    );
  });

  // 5. Tool deep link: content + canonical + og:image + no noindex
  await check('tool page deep link is complete', async () => {
    const { status, body } = await get(`${SITE}/${SAMPLE_TOOL}${stamp}`);
    const hasH1 = /<h1[\s>]/i.test(body);
    const canonical = body.match(/rel="canonical"\s+href="([^"]+)"/i)?.[1];
    const ogImage = body.match(/property="og:image"\s+content="([^"]+)"/i)?.[1];
    const noindex = /content="[^"]*noindex/i.test(body);
    const canonicalOk = canonical === `${SITE}/${SAMPLE_TOOL}`;
    record(
      `tool page deep link is complete (/${SAMPLE_TOOL})`,
      status === 200 && hasH1 && canonicalOk && Boolean(ogImage) && !noindex,
      `HTTP ${status} | h1 ${hasH1 ? 'yes' : 'no'} | canonical ${canonicalOk ? 'ok' : `bad (${canonical})`} | og:image ${ogImage ? 'yes' : 'no'} | noindex ${noindex ? 'yes' : 'no'}`,
    );

    // 6. og:image must really resolve, otherwise share cards render blank
    if (ogImage) {
      const img = await get(ogImage);
      const type = img.headers.get('content-type') || '';
      record(
        'og:image reachable',
        img.status === 200 && type.startsWith('image/'),
        `HTTP ${img.status} | ${type}`,
      );
    } else {
      record('og:image reachable', false, 'the page declares no og:image');
    }
  });

  // 7. Download page (the entry point for desktop revenue)
  await check('download page reachable', async () => {
    const { status, body } = await get(`${SITE}/download/${stamp}`);
    record(
      'download page reachable',
      status === 200 && /<h1[\s>]/i.test(body),
      `HTTP ${status} | h1 ${/<h1[\s>]/i.test(body) ? 'yes' : 'no'}`,
    );
  });

  // 8. Apex home 301s to the main domain
  await check('apex 301s to the main domain', async () => {
    const { status, headers } = await get(`${APEX}/${stamp}`, { redirect: 'manual' });
    const loc = headers.get('location') || '';
    record(
      'apex 301s to the main domain',
      status === 301 && loc.replace(/\?.*$/, '') === `${SITE}/`,
      `HTTP ${status} | location ${loc}`,
    );
  });

  // 9. Apex deep links must keep path and query — losing them funnels all authority to the home page
  await check('apex deep link keeps path and query', async () => {
    const path = '/tools/json-format/?a=1&b=2';
    const { status, headers } = await get(`${APEX}${path}`, { redirect: 'manual' });
    const loc = headers.get('location') || '';
    const expect = `${SITE}/tools/json-format/?a=1&b=2`;
    record(
      'apex deep link keeps path and query',
      status === 301 && loc === expect,
      `HTTP ${status} | expected ${expect} | actual ${loc}`,
    );
  });

  // 10. http must reach the https main domain in one hop, with no intermediate redirect
  await check('http reaches the https main domain in one hop', async () => {
    const httpApex = APEX.replace(/^https:/, 'http:');
    const { status, headers } = await get(`${httpApex}/tools/base64/`, { redirect: 'manual' });
    const loc = headers.get('location') || '';
    const ok = status === 301 && loc === `${SITE}/tools/base64/`;
    record('http reaches the https main domain in one hop', ok, `HTTP ${status} | location ${loc}`);
  });

  // 11. Both language trees exist and each <html lang> matches its directory
  await check('both language trees exist with correct lang', async () => {
    const en = await get(`${SITE}/${stamp}`);
    const zh = await get(`${SITE}/zh/${stamp}`);
    const enLang = en.body.match(/<html[^>]*\blang="([^"]+)"/i)?.[1] || '';
    const zhLang = zh.body.match(/<html[^>]*\blang="([^"]+)"/i)?.[1] || '';
    const ok = en.status === 200 && zh.status === 200 && enLang === 'en' && zhLang === 'zh-CN';
    record(
      'both language trees exist with correct lang',
      ok,
      `/${en.status} lang=${enLang} | /zh/ ${zh.status} lang=${zhLang}`,
    );
  });

  // 12. Three-way hreflang — with one missing, Google may treat the trees as duplicates and keep one
  await check('hreflang links all three ways', async () => {
    const { body } = await get(`${SITE}/${stamp}`);
    const alts = [...body.matchAll(/<link[^>]+hreflang="([^"]+)"[^>]+href="([^"]+)"/gi)].map(
      (m) => [m[1], m[2]],
    );
    const map = Object.fromEntries(alts.map(([h, href]) => [h, href]));
    const norm = (u) => (u || '').replace(/\?.*$/, '').replace(/\/$/, '');
    const ok =
      norm(map.en) === norm(SITE) &&
      norm(map['zh-CN']) === norm(`${SITE}/zh`) &&
      norm(map['x-default']) === norm(SITE);
    record(
      'hreflang links all three ways',
      ok,
      `en=${map.en || 'missing'} | zh-CN=${map['zh-CN'] || 'missing'} | x-default=${map['x-default'] || 'missing'}`,
    );
  });

  // 13. The Chinese tool page has its own title, not a copy of the English page
  await check('Chinese tool page has its own title', async () => {
    const zh = await get(`${SITE}/zh/${SAMPLE_TOOL}${stamp}`);
    const en = await get(`${SITE}/${SAMPLE_TOOL}${stamp}`);
    const zhTitle = zh.body.match(/<title>([^<]*)<\/title>/i)?.[1] || '';
    const enTitle = en.body.match(/<title>([^<]*)<\/title>/i)?.[1] || '';
    const hasCjk = /[\u4e00-\u9fa5]/.test(zhTitle);
    record(
      'Chinese tool page has its own title',
      zh.status === 200 && hasCjk && zhTitle !== enTitle,
      `/zh/ ${zh.status} | zh "${zhTitle}" | en "${enTitle}"`,
    );
  });

  // 14. The sitemap carries hreflang alternates and includes both trees
  await check('sitemap has language alternates', async () => {
    const { body } = await get(`${SITE}/sitemap.xml${stamp}`);
    const hasNs = /xmlns:xhtml=/.test(body);
    const altCount = (body.match(/<xhtml:link[^>]+hreflang=/g) || []).length;
    const hasZh = /<loc>[^<]*\/zh\/<\/loc>/.test(body);
    const ok = hasNs && altCount > 0 && hasZh;
    record(
      'sitemap has language alternates',
      ok,
      `xhtml namespace ${hasNs ? 'yes' : 'no'} | alternates ${altCount} | /zh/ entries ${hasZh ? 'yes' : 'no'}`,
    );
  });

  // ---- Output ----
  const pad = Math.max(...results.map((r) => r.name.length)) + 2;
  let failed = 0;
  console.log(`\nSite: ${SITE}    apex: ${APEX}\n`);
  for (const r of results) {
    if (!r.ok) failed += 1;
    console.log(`${r.ok ? '✓' : '✗'} ${r.name.padEnd(pad)}${r.detail}`);
  }
  console.log(`\n${results.length - failed}/${results.length} passed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
