/**
 * 面板布局（视图态）：右侧可停靠面板的「顺序 / 折叠 / 显隐」。
 *
 * 与 `viewport` 同级：属于会话 / 视图状态，不进文档历史，也随工具在 localStorage 单独持久化
 * （不占用 `draft.ts` 的文档草稿预算，避免超大草稿降级时把面板布局一起丢掉）。
 */

export type PanelId =
  'color' | 'layers' | 'style' | 'text' | 'channels' | 'property' | 'adjust' | 'filter' | 'history';

/** 面板全集（默认顺序即数组顺序）：颜色置顶、图层居中，与桌面修图软件的默认工作区一致 */
export const ALL_PANELS: readonly PanelId[] = [
  'color',
  'layers',
  'style',
  'text',
  'channels',
  'property',
  'adjust',
  'filter',
  'history',
];

export interface PanelLayout {
  /** 展示顺序（含隐藏面板，隐藏仅在渲染时过滤） */
  order: PanelId[];
  /** 折叠的面板 */
  collapsed: PanelId[];
  /** 隐藏的面板 */
  hidden: PanelId[];
}

export function defaultPanelLayout(): PanelLayout {
  return { order: [...ALL_PANELS], collapsed: [], hidden: [] };
}

const STORAGE_KEY = 'syntools:photo-editor.panels.v1';

function isPanelId(value: unknown): value is PanelId {
  return typeof value === 'string' && (ALL_PANELS as readonly string[]).includes(value);
}

function normalizeIds(raw: unknown): PanelId[] {
  if (!Array.isArray(raw)) return [];
  const out: PanelId[] = [];
  for (const id of raw) {
    if (isPanelId(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * 归一化外部数据（localStorage / 旧版本）：补全缺失面板、去重、丢弃未知 id。
 * 与 `model/migrate.ts` 同一思路——只补默认值、不猜测。
 */
export function normalizePanelLayout(raw: unknown): PanelLayout {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<PanelLayout>;
  const seen = new Set<PanelId>();
  const order: PanelId[] = [];
  if (Array.isArray(src.order)) {
    for (const id of src.order) {
      if (isPanelId(id) && !seen.has(id)) {
        seen.add(id);
        order.push(id);
      }
    }
  }
  for (const id of ALL_PANELS) {
    if (!seen.has(id)) order.push(id);
  }
  return { order, collapsed: normalizeIds(src.collapsed), hidden: normalizeIds(src.hidden) };
}

export function loadPanelLayout(): PanelLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizePanelLayout(raw ? JSON.parse(raw) : null);
  } catch {
    // 隐私模式 / 配额异常 / 脏数据：回落到默认布局
    return defaultPanelLayout();
  }
}

export function savePanelLayout(layout: PanelLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // 存储不可写时忽略：面板布局不是关键数据
  }
}
