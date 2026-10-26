/**
 * 第一方埋点采集器（Cloudflare Pages Function）。
 *
 * 为什么需要它：`src/core/analytics/index.ts` 早就在浏览器端准备好了队列、
 * 批量、DNT/GPC 尊重与 sendBeacon 投递，但**没有任何接收方** —— 未配置
 * `VITE_ANALYTICS_ENDPOINT` 时所有调用都是空操作。于是「周报看 DAU、Top10
 * 工具、工具失败率」这件事一直停在做不了的状态（见 plan/Monetization.md P0-1）。
 *
 * 设计约束：
 * - **不落地原始 IP、不写 Cookie**：Analytics Engine 的 index 用随机 session id，
 *   只用于「同一次访问的事件聚在一起」，不含任何可识别个人的信息。
 * - **只接受白名单事件名与白名单属性**：即使前端被篡改，这个函数也不会变成
 *   一个任意写入的开放端点。
 * - **没有绑定就静默丢弃**：未配置 `ANALYTICS` 绑定时直接 204，不报错、不写日志，
 *   这样本地预览、GitHub Pages 等没有绑定的部署也照常工作。
 * - **同源**：站点 CSP 的 connect-src 为 'self'，本函数天然只能被本站调用。
 */

/** Workers Analytics Engine 的最小结构（避免为几个字段引入 workers-types） */
interface AnalyticsEngineDataset {
  writeDataPoint(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}

interface Env {
  ANALYTICS?: AnalyticsEngineDataset;
}

interface PagesContext {
  request: Request;
  env: Env;
}

/** 与前端 EventName 保持一致；新增事件必须同时改两处 */
const ALLOWED_EVENTS = new Set([
  'tool_open',
  'tool_duration',
  'tool_error',
  'download_click',
  'search_use',
  'page_view',
  'pricing_view',
  'inquiry_click',
]);

/** 单次请求上限：正常批量是 8 条，留足余量但不接受大包 */
const MAX_BYTES = 4096;
const MAX_EVENTS = 20;
const MAX_PROPS = 8;
const MAX_STR = 64;

type PropBag = Record<string, string | number | boolean>;

interface RawEvent {
  n?: unknown;
  p?: unknown;
  t?: unknown;
}

function empty(status: number): Response {
  return new Response(null, { status });
}

/** 把属性收敛成「按 key 排序的短字符串」，便于在 Analytics Engine 里按列过滤 */
function flattenProps(props: PropBag | undefined): string {
  if (!props) return '';
  const entries = Object.entries(props)
    .filter(([key]) => key.length <= 24)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, MAX_PROPS);
  return entries
    .map(([key, value]) => {
      const text =
        typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : value.slice(0, MAX_STR);
      return `${key}=${text}`;
    })
    .join('&');
}

function sanitize(raw: RawEvent): { name: string; props: string; ms: number } | null {
  if (typeof raw?.n !== 'string' || !ALLOWED_EVENTS.has(raw.n)) return null;
  const ms = typeof raw.t === 'number' && Number.isFinite(raw.t) ? Math.max(0, raw.t) : 0;
  const props = raw.p && typeof raw.p === 'object' ? flattenProps(raw.p as PropBag) : '';
  return { name: raw.n, props, ms };
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BYTES) return empty(413);

  let body: string;
  try {
    body = await request.text();
  } catch {
    return empty(400);
  }
  if (body.length === 0 || body.length > MAX_BYTES)
    return empty(body.length > MAX_BYTES ? 413 : 400);

  let payload: { sid?: unknown; lng?: unknown; events?: unknown };
  try {
    payload = JSON.parse(body) as typeof payload;
  } catch {
    return empty(400);
  }

  const events = Array.isArray(payload.events) ? (payload.events as RawEvent[]) : [];
  if (events.length === 0 || events.length > MAX_EVENTS) return empty(400);

  // 没有绑定就当成功：调用方不该为「没配分析」而看到失败
  const dataset = env.ANALYTICS;
  if (!dataset) return empty(204);

  const sid = typeof payload.sid === 'string' ? payload.sid.slice(0, 32) : 'anon';
  const lng = typeof payload.lng === 'string' ? payload.lng.slice(0, 10) : '';

  for (const raw of events) {
    const event = sanitize(raw);
    if (!event) continue;
    // 属性形如 "id=json-format&ms=812"，取 id 单独成列，方便按工具聚合
    const idMatch = /(?:^|&)id=([^&]*)/.exec(event.props);
    dataset.writeDataPoint({
      indexes: [sid],
      blobs: [event.name, idMatch?.[1] ?? '', lng, event.props],
      doubles: [event.ms],
    });
  }

  return empty(204);
}

/** 非 POST 一律拒绝，避免被当成可探测的开放端点 */
export async function onRequest(): Promise<Response> {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
