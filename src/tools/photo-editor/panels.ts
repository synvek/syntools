/**
 * 面板布局（视图态）：右侧三个固定面板，每个面板记录当前选中的子 tab。
 *
 * 与 `viewport` 同级：属于会话 / 视图状态，不进文档历史，也随工具在 localStorage 单独持久化
 * （不占用 `draft.ts` 的文档草稿预算，避免超大草稿降级时把面板布局一起丢掉）。
 */

export type PanelId =
  'color' | 'layers' | 'style' | 'text' | 'channels' | 'property' | 'adjust' | 'filter' | 'history';

/** 三个固定面板（自上而下）：每个面板内部是一组子 tab，同一时刻只显示一个子面板 */
export type PanelGroupId = 'color' | 'layers' | 'info';

export interface PanelGroup {
  id: PanelGroupId;
  /** 面板内的子 tab（数组顺序即 tab 顺序） */
  panels: readonly PanelId[];
}

/**
 * 三个面板按修图任务划分（参考 Photoshop / Photopea 的停靠区）：
 * - 颜色：颜色、调整、滤镜 —— 调色与效果，作用于整幅画面；
 * - 图层：图层、图层样式、通道 —— 结构类，处理「这份内容由什么组成」；
 * - 信息：文字、属性、历史 —— 单对象的参数与操作轨迹。
 */
export const PANEL_GROUPS: readonly PanelGroup[] = [
  { id: 'color', panels: ['color', 'adjust', 'filter'] },
  { id: 'layers', panels: ['layers', 'style', 'channels'] },
  { id: 'info', panels: ['text', 'property', 'history'] },
];

/** 面板全集（按面板 / tab 顺序排列） */
export const ALL_PANELS: readonly PanelId[] = PANEL_GROUPS.flatMap((group) => [...group.panels]);

export const PANEL_GROUP_OF: Record<PanelId, PanelGroupId> = PANEL_GROUPS.reduce(
  (map, group) => {
    for (const id of group.panels) map[id] = group.id;
    return map;
  },
  {} as Record<PanelId, PanelGroupId>,
);

export function panelGroupOf(id: PanelId): PanelGroupId {
  return PANEL_GROUP_OF[id];
}

/** 每个面板当前选中的子 tab */
export type PanelTabs = Record<PanelGroupId, PanelId>;

export interface PanelLayout {
  tabs: PanelTabs;
}

/** 默认选中各面板的主力 tab：颜色 / 图层 / 属性 */
export function defaultPanelLayout(): PanelLayout {
  return { tabs: { color: 'color', layers: 'layers', info: 'property' } };
}

// 结构变化（旧的 order / collapsed / hidden 已不再适用），换键让旧数据自然回落默认值
const STORAGE_KEY = 'syntools:photo-editor.panels.v2';

function isPanelOfGroup(groupId: PanelGroupId, value: unknown): value is PanelId {
  if (typeof value !== 'string') return false;
  const group = PANEL_GROUPS.find((item) => item.id === groupId);
  return group?.panels.some((id) => id === value) ?? false;
}

/**
 * 归一化外部数据（localStorage / 旧版本）：逐面板校验，非法值回退到该面板的默认 tab。
 * 与 `model/migrate.ts` 同一思路——只补默认值、不猜测（例如不会把「颜色」面板的旧状态映射到别处）。
 */
export function normalizePanelLayout(raw: unknown): PanelLayout {
  const fallback = defaultPanelLayout();
  if (!raw || typeof raw !== 'object') return fallback;
  const rawTabs = (raw as { tabs?: unknown }).tabs;
  if (!rawTabs || typeof rawTabs !== 'object') return fallback;
  const stored = rawTabs as Record<string, unknown>;
  const tabs: PanelTabs = { ...fallback.tabs };
  for (const group of PANEL_GROUPS) {
    const value = stored[group.id];
    if (isPanelOfGroup(group.id, value)) tabs[group.id] = value;
  }
  return { tabs };
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
