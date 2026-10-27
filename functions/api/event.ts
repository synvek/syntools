/**
 * First-party analytics collector (Cloudflare Pages Function).
 *
 * Why it exists: `src/core/analytics/index.ts` has long prepared the queue,
 * batching, DNT/GPC respect and sendBeacon delivery in the browser, but there
 * was **no receiver** — without `VITE_ANALYTICS_ENDPOINT` every call is a no-op.
 * So "weekly DAU, Top 10 tools, tool failure rate" stayed impossible to answer
 * (see plan/Monetization.md P0-1).
 *
 * Design constraints:
 * - **No raw IP, no cookies**: the Analytics Engine index uses a random session
 *   id, only to group events from the same visit; it holds no personal data.
 * - **Only whitelisted event names and properties**: even if the frontend is
 *   tampered with, this function never becomes an open write endpoint.
 * - **Drop silently without a binding**: when `ANALYTICS` is unbound it returns
 *   204 without errors or logs, so local preview and GitHub Pages deployments
 *   without a binding keep working.
 * - **Same origin**: the site CSP sets connect-src to 'self', so this function
 *   can only be called by the site itself.
 */

/** Minimal Workers Analytics Engine shape (avoids pulling in workers-types for a few fields) */
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

/** Must match the frontend EventName; adding an event means changing both places */
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

/** Per-request limits: normal batches are 8 events; leave headroom but reject large payloads */
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

/** Flatten properties into a "key-sorted short string" so Analytics Engine can filter by column */
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

/**
 * Single entry point: dispatch by method.
 *
 * We used to export both `onRequest` and `onRequestPost`, relying on Pages route
 * precedence — if that precedence was off, POST hit the 405 branch, looking like
 * "the frontend sends but the backend never receives". One entry point makes the
 * behaviour deterministic, and GET now always returns a 405 with `Allow: POST`,
 * which doubles as a probe for "is the function actually deployed" (see below).
 */
export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method !== 'POST') {
    // Probe: a live GET /api/event returning 405 + allow: POST means the function is deployed;
    // a 404 means static hosting took the path, i.e. functions/ was not built (not deployed).
    return new Response(null, { status: 405, headers: { allow: 'POST' } });
  }

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

  // Treat a missing binding as success: callers should not see failures for "no analytics configured"
  const dataset = env.ANALYTICS;
  if (!dataset) return empty(204);

  const sid = typeof payload.sid === 'string' ? payload.sid.slice(0, 32) : 'anon';
  const lng = typeof payload.lng === 'string' ? payload.lng.slice(0, 10) : '';

  for (const raw of events) {
    const event = sanitize(raw);
    if (!event) continue;
    // Properties look like "id=json-format&ms=812"; keep id as its own column to aggregate per tool
    const idMatch = /(?:^|&)id=([^&]*)/.exec(event.props);
    dataset.writeDataPoint({
      indexes: [sid],
      blobs: [event.name, idMatch?.[1] ?? '', lng, event.props],
      doubles: [event.ms],
    });
  }

  return empty(204);
}
