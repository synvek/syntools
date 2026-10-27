import { i18n } from '@/core/i18n';

/**
 * First-party, privacy-first analytics.
 *
 * Design constraints (compatible with the "data never leaves the browser" promise):
 * - **Off by default**: no request is made unless `VITE_ANALYTICS_ENDPOINT` is set at build time;
 *   without it every call is a no-op and the page makes zero requests.
 * - **Same-origin reporting**: the endpoint must share the site's origin, otherwise the CSP `connect-src`
 *   has to be relaxed (see `public/_headers` and `vercel.json`).
 * - **No content collection**: only event name, tool id, duration and UI language; never input or file content,
 *   no cookies, no cross-site identifiers. The session id is random, lives in sessionStorage and dies with the tab.
 * - **Respects user intent**: nothing is collected when `DNT: 1` or Global Privacy Control is active.
 *
 * Minimal way to wire a backend: a same-origin Cloudflare Worker / Vercel Function that
 * appends the JSON body to Workers Analytics Engine or KV, then export weekly reports.
 */

type EventName =
  | 'tool_open'
  | 'tool_duration'
  | 'tool_error'
  | 'download_click'
  | 'search_use'
  /** Page view (marketing / trust pages only, to see whether pricing is really opened) */
  | 'page_view'
  /** Pricing page view: separate from page_view, the only denominator for conversion */
  | 'pricing_view'
  /** Sales inquiry click: contact action started from pricing or security */
  | 'inquiry_click';

interface QueuedEvent {
  /** Event name */
  n: EventName;
  /** Extra properties (non-content fields only) */
  p?: Record<string, string | number | boolean>;
  /** Milliseconds since page load */
  t: number;
}

const ENDPOINT = (import.meta.env.VITE_ANALYTICS_ENDPOINT ?? '').trim();
const SESSION_KEY = 'syntools:analytics.sid.v1';
const FLUSH_INTERVAL_MS = 10_000;
const MAX_BATCH = 8;

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;
/** Current tool id, so ErrorBoundary can attribute errors without props */
let currentToolId: string | null = null;

function isOptedOut(): boolean {
  if (typeof navigator === 'undefined') return true;
  const dnt = navigator.doNotTrack ?? (window as { doNotTrack?: string }).doNotTrack;
  if (dnt === '1' || dnt === 'yes') return true;
  const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
  return gpc === true;
}

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return 'anon';
  }
}

function send(events: QueuedEvent[]): void {
  if (!ENDPOINT || events.length === 0) return;
  const payload = JSON.stringify({
    sid: sessionId(),
    lng: i18n.resolvedLanguage ?? 'en',
    events,
  });
  try {
    // sendBeacon survives page unload and never blocks navigation
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {
      /* Analytics failures never affect the product; drop them silently */
    });
  } catch {
    /* ignore */
  }
}

function flush(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const batch = queue;
  queue = [];
  send(batch);
}

function schedule(): void {
  if (timer || queue.length === 0) return;
  timer = setTimeout(flush, FLUSH_INTERVAL_MS);
}

function attachLifecycle(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  // Flush remaining events on hide/unload (minimal bundle: listeners attach only when analytics is on)
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

/** Record an event (a no-op when no endpoint is configured) */
export function track(name: EventName, props?: QueuedEvent['p']): void {
  if (!ENDPOINT || isOptedOut()) return;
  attachLifecycle();
  queue.push({
    n: name,
    ...(props ? { p: props } : {}),
    t: typeof performance !== 'undefined' ? Math.round(performance.now()) : 0,
  });
  if (queue.length >= MAX_BATCH) flush();
  else schedule();
}

/** Enter a tool page: log the open event and make it the current tool for error attribution */
export function trackToolOpen(toolId: string): void {
  currentToolId = toolId;
  track('tool_open', { id: toolId });
}

/** Leave a tool page: log dwell time (shows which tools are actually used) */
export function trackToolDuration(toolId: string, durationMs: number): void {
  if (durationMs < 1000) return; // Instant bounce is usually a misclick; keep it out of the stats
  track('tool_duration', { id: toolId, ms: Math.min(durationMs, 30 * 60 * 1000) });
}

/** Tool error: report only the error type and tool id, never the input */
export function trackToolError(message: string): void {
  track('tool_error', {
    ...(currentToolId ? { id: currentToolId } : {}),
    // Truncate and strip newlines so user data or huge stacks never leave
    msg: message.replace(/\s+/g, ' ').slice(0, 120),
  });
}

/** Desktop download click: log the platform to gauge download page conversion */
export function trackDownloadClick(platform: string): void {
  track('download_click', { os: platform });
}

/** Whether analytics is enabled (for debugging / the settings page) */
export const analyticsEnabled = Boolean(ENDPOINT);
