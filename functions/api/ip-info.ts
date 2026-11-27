/**
 * 访客 IP 归属地（Cloudflare Pages Function）。
 *
 * 为什么放在服务端：浏览器的 `fetch` 拿不到自己的公网 IP，只有边缘节点知道
 * `request.cf`。这个函数把它转成 JSON 给前端，全程同源（CSP 的 `connect-src`
 * 保持 `'self'`，不需要放开任何外部域名）。
 *
 * 约束：
 * - **只查自己**：不接受任何入参（没有 `?ip=`），因此不会变成第三方 IP 库的代理，
 *   也不会替别人查地址；
 * - **不落库、不打日志、不下 Cookie**：只把 `request.cf` 的字段读出来返回；
 * - **不调用第三方**：地区和运营商来自 Cloudflare 边缘节点自带的 MaxMind 数据，
 *   你的 IP 不会被转发给任何第三方；
 * - 只有 `PLUS_MODE=true`（`pnpm build:cf`）的部署才会带上这个函数。
 */

/** `request.cf` 中本函数用到的字段（不引入 workers-types，只声明用到的部分） */
interface IncomingRequestCf {
  country?: string;
  region?: string;
  regionCode?: string;
  city?: string;
  continent?: string;
  postalCode?: string;
  timezone?: string;
  asn?: number;
  asOrganization?: string;
  colo?: string;
}

interface PagesContext {
  request: Request & { cf?: IncomingRequestCf };
}

/** 单个字段的长度上限：异常长的值直接截断，避免把响应撑大 */
const MAX_FIELD = 96;

function text(value: unknown, max = MAX_FIELD): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // 结果只对当前访客有意义，任何缓存都是错的
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

/** 空结果：`available: false` 让前端给出「该地区/本地开发无数据」的提示而不是报错 */
function unavailable(ip: string): Response {
  return json({
    ip,
    available: false,
    country: '',
    region: '',
    regionCode: '',
    city: '',
    continent: '',
    postalCode: '',
    timezone: '',
    asn: null,
    isp: '',
    colo: '',
  });
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request } = context;

  // 探针：GET 说明函数确实部署了；405 + Allow 与 /api/event 保持一致
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { allow: 'GET' } });
  }

  const ip = text(request.headers.get('cf-connecting-ip'), 64);

  const cf = request.cf;
  if (!cf || (!cf.country && !cf.asOrganization)) {
    // 本地 `vite dev` / `wrangler pages dev` 没有地理数据集
    return unavailable(ip);
  }

  return json({
    ip,
    available: true,
    country: text(cf.country, 2).toUpperCase(),
    region: text(cf.region),
    regionCode: text(cf.regionCode, 16),
    city: text(cf.city),
    continent: text(cf.continent, 2).toUpperCase(),
    postalCode: text(cf.postalCode, 16),
    timezone: text(cf.timezone, 64),
    asn: typeof cf.asn === 'number' && Number.isFinite(cf.asn) ? cf.asn : null,
    // "China Telecom" / "China Unicom" / "China Mobile" 等，前端再归类到具体运营商
    isp: text(cf.asOrganization, 64),
    colo: text(cf.colo, 8),
  });
}
