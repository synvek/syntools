/**
 * 双屏演讲者视图（P2-S10 / SLIDE-10）。
 *
 * 形态：放映时用 `window.open` 开一个副屏窗口，副屏显示"当前页 + 下一张 + 备注 + 计时"，
 * 两个窗口通过 `BroadcastChannel` 通信（同源窗口共享，比 postMessage 少了"等 load 再握手"的时序问题）。
 *
 * 为什么副屏是手写 HTML 而不是 React portal：新窗口没有主文档的样式表（Tailwind 在 Vite 里是
 * 注入的 `<style>`，生产是 hash 命名的 CSS 文件），portal 过去会变成一堆无样式的裸元素。
 * 所以副屏自带一份内联样式，主窗口只负责"渲染位图 + 发消息"，样式与主文档完全解耦。
 *
 * 本文件是纯逻辑（协议 + HTML 生成），不碰 React/DOM，方便单测。
 */

export const PRESENTER_CHANNEL = 'syntools-slide-presenter';

/** 副屏 DOM id：生成 HTML 的内联脚本与测试共用一份，避免两边各写一遍字符串 */
export const PRESENTER_IDS = {
  current: 'presenter-current',
  next: 'presenter-next',
  notes: 'presenter-notes',
  clock: 'presenter-clock',
  counter: 'presenter-counter',
  status: 'presenter-status',
  prev: 'presenter-prev',
  nextButton: 'presenter-next-button',
} as const;

/** 副屏要显示的文案（由主窗口按当前语言传入，副屏不参与 i18n） */
export interface PresenterLabels {
  /** 窗口标题 */
  title: string;
  current: string;
  next: string;
  notes: string;
  notesEmpty: string;
  prev: string;
  nextAction: string;
  /** 还没收到第一帧时的占位 */
  waiting: string;
}

/** 换页：当前页 + 下一张都是位图（dataURL），备注是纯文本 */
export interface PresenterFrame {
  type: 'frame';
  /** 0 基 */
  index: number;
  total: number;
  current: string | null;
  next: string | null;
  notes: string;
}

export interface PresenterTick {
  type: 'tick';
  elapsed: number;
}

/** 主窗口退出放映：副屏自行关闭 */
export interface PresenterClosed {
  type: 'closed';
}

/** 副屏 → 主窗口：副屏上的翻页按钮 */
export interface PresenterCommand {
  type: 'command';
  action: 'next' | 'prev';
}

export type PresenterMessage = PresenterFrame | PresenterTick | PresenterClosed | PresenterCommand;

/** 消息来自 `postMessage`/`BroadcastChannel`，结构不可信，一律先过这道判断 */
export function isPresenterMessage(value: unknown): value is PresenterMessage {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  if (type === 'frame') {
    const frame = value as Partial<PresenterFrame>;
    return typeof frame.index === 'number' && typeof frame.total === 'number';
  }
  if (type === 'tick') return typeof (value as Partial<PresenterTick>).elapsed === 'number';
  if (type === 'closed') return true;
  if (type === 'command') {
    const action = (value as Partial<PresenterCommand>).action;
    return action === 'next' || action === 'prev';
  }
  return false;
}

/** 秒 → `m:ss`（与主窗口计时器同一格式，副屏内联脚本里也有一份等价实现） */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`;
}

/** 副屏窗口还能用吗（用户可能自己点了关闭） */
export function isPresenterAlive(win: Window | null | undefined): boolean {
  return Boolean(win && !win.closed);
}

/** `window.open` 的目标名：同名窗口会被复用，避免连点开出一堆副屏 */
export const PRESENTER_WINDOW_NAME = 'syntools-slide-presenter';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 内联脚本里的字符串字面量：转义 `<` 防止文案里出现 `</script>` 把脚本截断 */
function jsString(text: string): string {
  return JSON.stringify(text).replace(/</g, '\\u003c');
}

/**
 * 副屏骨架 HTML。
 *
 * 内联脚本只做三件事：收 frame/tick/closed 更新 DOM、按钮回发 command、初次显示"等待连接"。
 * 业务判断（翻页顺序、动画推进）全部留在主窗口，副屏不做决策。
 */
export function presenterHtml(labels: PresenterLabels): string {
  const id = PRESENTER_IDS;
  const text = {
    title: escapeHtml(labels.title),
    current: escapeHtml(labels.current),
    next: escapeHtml(labels.next),
    notes: escapeHtml(labels.notes),
    notesEmpty: escapeHtml(labels.notesEmpty),
    prev: escapeHtml(labels.prev),
    nextAction: escapeHtml(labels.nextAction),
    waiting: escapeHtml(labels.waiting),
  };

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<title>${text.title}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0b1220; color: #e5e7eb; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .wrap { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; height: 100vh; padding: 16px; }
  .stage { position: relative; display: flex; align-items: center; justify-content: center; min-height: 0; background: #000; border-radius: 12px; overflow: hidden; }
  .stage img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .side { display: flex; flex-direction: column; gap: 12px; min-height: 0; }
  .card { border: 1px solid #334155; border-radius: 12px; background: #111c2e; padding: 12px; }
  .card h2 { margin: 0 0 8px; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: #94a3b8; }
  .preview { display: flex; align-items: center; justify-content: center; height: 150px; background: #000; border-radius: 8px; overflow: hidden; }
  .preview img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .notes { flex: 1; min-height: 0; overflow-y: auto; white-space: pre-wrap; }
  .bar { display: flex; align-items: center; gap: 8px; }
  .bar .clock { margin-left: auto; font-variant-numeric: tabular-nums; font-size: 20px; }
  button { font: inherit; color: #e5e7eb; background: #1e293b; border: 1px solid #475569; border-radius: 8px; padding: 6px 12px; cursor: pointer; }
  button:hover { background: #273449; }
  .muted { color: #64748b; font-size: 12px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="stage"><img id="${id.current}" alt="${text.current}" style="visibility:hidden" /></div>
  <div class="side">
    <div class="bar">
      <span id="${id.counter}" class="muted">1 / 1</span>
      <span id="${id.clock}" class="clock">0:00</span>
    </div>
    <div class="card">
      <h2>${text.next}</h2>
      <div class="preview"><img id="${id.next}" alt="${text.next}" style="visibility:hidden" /></div>
    </div>
    <div class="card notes">
      <h2>${text.notes}</h2>
      <div id="${id.notes}">${text.notesEmpty}</div>
    </div>
    <div class="bar">
      <button id="${id.prev}" type="button">${text.prev}</button>
      <button id="${id.nextButton}" type="button">${text.nextAction}</button>
    </div>
    <div id="${id.status}" class="muted">${text.waiting}</div>
  </div>
</div>
<script>
(function () {
  var CHANNEL = '${PRESENTER_CHANNEL}';
  var EMPTY = ${jsString(labels.notesEmpty)};
  function el(id) { return document.getElementById(id); }
  function setText(id, text) { var node = el(id); if (node) node.textContent = text; }
  function setImage(id, src) {
    var img = el(id);
    if (!img) return;
    if (src) { img.src = src; img.style.visibility = 'visible'; }
    else { img.removeAttribute('src'); img.style.visibility = 'hidden'; }
  }
  function clock(total) {
    var seconds = Math.max(0, Math.floor(total || 0));
    var rest = seconds % 60;
    return Math.floor(seconds / 60) + ':' + (rest < 10 ? '0' : '') + rest;
  }
  var channel;
  try { channel = new BroadcastChannel(CHANNEL); } catch (error) { channel = null; }
  if (!channel) { setText('${id.status}', ${jsString(labels.waiting)}); return; }
  channel.onmessage = function (event) {
    var data = event.data || {};
    if (data.type === 'frame') {
      setText('${id.status}', '');
      setImage('${id.current}', data.current);
      setImage('${id.next}', data.next);
      setText('${id.notes}', data.notes || EMPTY);
      setText('${id.counter}', (data.index + 1) + ' / ' + data.total);
    } else if (data.type === 'tick') {
      setText('${id.clock}', clock(data.elapsed));
    } else if (data.type === 'closed') {
      window.close();
    }
  };
  function send(action) { channel.postMessage({ type: 'command', action: action }); }
  var prev = el('${id.prev}');
  var next = el('${id.nextButton}');
  if (prev) prev.onclick = function () { send('prev'); };
  if (next) next.onclick = function () { send('next'); };
})();
</script>
</body>
</html>`;
}

/** 建通道；环境不支持（老 WebView / 隐私模式）时返回 null，调用方降级为"只有站内备注面板" */
export function createPresenterChannel(name: string = PRESENTER_CHANNEL): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(name);
  } catch {
    return null;
  }
}
