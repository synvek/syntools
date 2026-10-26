import { i18n } from '@/core/i18n';

/**
 * 第一方、隐私优先的埋点。
 *
 * 设计约束（与「数据不离开浏览器」的承诺不冲突）：
 * - **默认完全关闭**：只有构建时设置 `VITE_ANALYTICS_ENDPOINT` 才会发出任何请求，
 *   未设置时所有调用都是空操作，页面零网络请求。
 * - **同源上报**：端点必须与站点同源，否则还需放宽 CSP 的 `connect-src`
 *   （见 `public/_headers` 与 `vercel.json`）。
 * - **不采集内容**：只上报事件名、工具 id、耗时、界面语言；不碰输入框/文件内容，
 *   不使用 cookie，不做跨站标识。session id 为随机值，存于 sessionStorage，关标签页即失效。
 * - **尊重用户意愿**：`DNT: 1` 或 Global Privacy Control 生效时直接不采集。
 *
 * 接后端的最小落地方式：一个同源 Cloudflare Worker / Vercel Function，
 * 把 JSON body 追加写入 Workers Analytics Engine 或 KV，再导出周报。
 */

type EventName =
  | 'tool_open'
  | 'tool_duration'
  | 'tool_error'
  | 'download_click'
  | 'search_use'
  /** 页面浏览（仅营销/信任页，用于判断定价页是否被真实打开） */
  | 'page_view'
  /** 定价页浏览：与 page_view 分开，转化率只看这一个分母 */
  | 'pricing_view'
  /** 商务询价点击：从定价页或安全页发起的联系动作 */
  | 'inquiry_click';

interface QueuedEvent {
  /** 事件名 */
  n: EventName;
  /** 附加属性（只允许非内容型字段） */
  p?: Record<string, string | number | boolean>;
  /** 相对页面加载的毫秒时间戳 */
  t: number;
}

const ENDPOINT = (import.meta.env.VITE_ANALYTICS_ENDPOINT ?? '').trim();
const SESSION_KEY = 'syntools:analytics.sid.v1';
const FLUSH_INTERVAL_MS = 10_000;
const MAX_BATCH = 8;

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;
/** 当前工具 id：供 ErrorBoundary 在拿不到 props 时归因 */
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
    // sendBeacon 在页面卸载时仍能送达，且不阻塞导航
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
      /* 埋点失败不影响产品功能，静默丢弃 */
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
  // 页面隐藏/卸载时把剩余事件发出去（bundle 最小化：只在启用埋点后才挂监听）
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

/** 记录一个事件（未配置端点时为空操作） */
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

/** 进入工具页：记录打开事件，并把它设为错误归因的当前工具 */
export function trackToolOpen(toolId: string): void {
  currentToolId = toolId;
  track('tool_open', { id: toolId });
}

/** 离开工具页：记录停留时长（用于判断哪些工具真被用起来） */
export function trackToolDuration(toolId: string, durationMs: number): void {
  if (durationMs < 1000) return; // 秒开秒走多半是误点，不参与统计
  track('tool_duration', { id: toolId, ms: Math.min(durationMs, 30 * 60 * 1000) });
}

/** 工具运行出错：只上报错误类型与工具 id，不上报输入内容 */
export function trackToolError(message: string): void {
  track('tool_error', {
    ...(currentToolId ? { id: currentToolId } : {}),
    // 截断并去掉换行，避免把用户数据或超长堆栈带出去
    msg: message.replace(/\s+/g, ' ').slice(0, 120),
  });
}

/** 桌面版下载点击：记录平台，用于判断下载页转化 */
export function trackDownloadClick(platform: string): void {
  track('download_click', { os: platform });
}

/** 埋点是否启用（供调试/设置页展示） */
export const analyticsEnabled = Boolean(ENDPOINT);
