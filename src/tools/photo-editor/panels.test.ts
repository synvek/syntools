import { describe, expect, it } from 'vitest';
import {
  ALL_PANELS,
  PANEL_GROUPS,
  defaultPanelLayout,
  normalizePanelLayout,
  panelGroupOf,
} from './panels';

describe('photo panels layout', () => {
  it('default layout selects one sub-tab per panel', () => {
    expect(defaultPanelLayout()).toEqual({
      tabs: { color: 'color', layers: 'layers', info: 'property' },
    });
  });

  it('three panels cover every sub-panel exactly once', () => {
    expect(PANEL_GROUPS).toHaveLength(3);
    const grouped = PANEL_GROUPS.flatMap((group) => [...group.panels]);
    expect(new Set(grouped)).toEqual(new Set(ALL_PANELS));
    expect(grouped).toHaveLength(ALL_PANELS.length);
    for (const group of PANEL_GROUPS) {
      expect(group.panels.length).toBeGreaterThan(1);
      for (const id of group.panels) expect(panelGroupOf(id)).toBe(group.id);
    }
  });

  it('normalize: keeps each panel’s stored sub-tab', () => {
    const layout = normalizePanelLayout({
      tabs: { color: 'filter', layers: 'channels', info: 'history' },
    });
    expect(layout.tabs).toEqual({ color: 'filter', layers: 'channels', info: 'history' });
  });

  it('normalize: falls back per panel and ignores tabs of another panel', () => {
    const layout = normalizePanelLayout({ tabs: { color: 'layers', layers: 'style' } });
    // 'layers' 属于图层面板，不能当作颜色面板的选中项
    expect(layout.tabs).toEqual({ color: 'color', layers: 'style', info: 'property' });
  });

  it('normalize: ignores unknown keys and keeps the remaining valid tabs', () => {
    const layout = normalizePanelLayout({ tabs: { color: 'adjust', nope: 'history' } });
    expect(layout.tabs).toEqual({ color: 'adjust', layers: 'layers', info: 'property' });
  });

  it('normalize: legacy layouts fall back to the default tabs', () => {
    // v1 数据：扁平面板列表（order / collapsed / hidden / activeGroup），与新结构不兼容
    const layout = normalizePanelLayout({
      order: ['history', 'layers'],
      collapsed: ['filter'],
      hidden: ['text'],
      activeGroup: 'layers',
    });
    expect(layout).toEqual(defaultPanelLayout());
  });

  it('normalize: non-object input falls back to the default layout', () => {
    expect(normalizePanelLayout(null)).toEqual(defaultPanelLayout());
    expect(normalizePanelLayout('garbage')).toEqual(defaultPanelLayout());
    expect(normalizePanelLayout(42)).toEqual(defaultPanelLayout());
  });

  it('normalize: missing or malformed tabs falls back to default', () => {
    expect(normalizePanelLayout({ tabs: 'x' })).toEqual(defaultPanelLayout());
    expect(normalizePanelLayout({ tabs: { color: 'nope' } })).toEqual(defaultPanelLayout());
  });
});
