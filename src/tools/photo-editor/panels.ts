/**
 * Panel layout (view state): three fixed panels on the right, each remembering its selected sub tab.
 *
 * Same tier as `viewport`: session / view state, not in document history, persisted separately in
 * localStorage (so it never eats `draft.ts`'s document budget or gets dropped with oversized drafts).
 */

export type PanelId =
  'color' | 'layers' | 'style' | 'text' | 'channels' | 'property' | 'adjust' | 'filter' | 'history';

/** The three fixed panels (top to bottom): each holds a set of sub tabs, one visible at a time */
export type PanelGroupId = 'color' | 'layers' | 'info';

export interface PanelGroup {
  id: PanelGroupId;
  /** Sub tabs inside the panel (array order is tab order) */
  panels: readonly PanelId[];
}

/**
 * The three panels split by editing task (mirroring Photoshop / Photopea docks):
 * - Color: color, adjustments, filters — grading and effects on the whole picture;
 * - Layers: layers, layer styles, channels — structure, i.e. "what makes up this content";
 * - Info: text, properties, history — one object's parameters and the trail of operations.
 */
export const PANEL_GROUPS: readonly PanelGroup[] = [
  { id: 'color', panels: ['color', 'adjust', 'filter'] },
  { id: 'layers', panels: ['layers', 'style', 'channels'] },
  { id: 'info', panels: ['text', 'property', 'history'] },
];

/** All panels (in panel / tab order) */
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

/** The sub tab currently selected in each panel */
export type PanelTabs = Record<PanelGroupId, PanelId>;

export interface PanelLayout {
  tabs: PanelTabs;
}

/** Default sub tab per panel: color / layers / properties */
export function defaultPanelLayout(): PanelLayout {
  return { tabs: { color: 'color', layers: 'layers', info: 'property' } };
}

// The structure changed (old order / collapsed / hidden no longer apply); a new key resets old data
const STORAGE_KEY = 'syntools:photo-editor.panels.v2';

function isPanelOfGroup(groupId: PanelGroupId, value: unknown): value is PanelId {
  if (typeof value !== 'string') return false;
  const group = PANEL_GROUPS.find((item) => item.id === groupId);
  return group?.panels.some((id) => id === value) ?? false;
}

/**
 * Normalize external data (localStorage / older versions): validate per panel; invalid values fall back.
 * Same approach as `model/migrate.ts`: fill defaults, never guess (old "color" state isn't remapped elsewhere).
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
    // Private mode / quota errors / dirty data: fall back to the default layout
    return defaultPanelLayout();
  }
}

export function savePanelLayout(layout: PanelLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Ignore write failures: panel layout isn't critical data
  }
}
