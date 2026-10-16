import { describe, expect, it } from 'vitest';
import { ALL_PANELS, defaultPanelLayout, normalizePanelLayout } from './panels';

describe('photo panels layout', () => {
  it('default layout lists every panel exactly once, all expanded and visible', () => {
    const layout = defaultPanelLayout();
    expect(layout.order).toEqual([...ALL_PANELS]);
    expect(layout.collapsed).toEqual([]);
    expect(layout.hidden).toEqual([]);
  });

  it('normalize: fills missing panels and preserves a partial order', () => {
    const layout = normalizePanelLayout({ order: ['history', 'layers'] });
    expect(layout.order.slice(0, 2)).toEqual(['history', 'layers']);
    expect(new Set(layout.order)).toEqual(new Set(ALL_PANELS));
    expect(layout.order).toHaveLength(ALL_PANELS.length);
  });

  it('normalize: drops unknown ids and de-duplicates', () => {
    const layout = normalizePanelLayout({
      order: ['history', 'history', 'nope', 'layers'],
      collapsed: ['history', 'bogus'],
      hidden: ['layers', 'layers'],
    });
    expect(layout.order.filter((id) => id === 'history')).toHaveLength(1);
    expect(layout.order).not.toContain('nope' as never);
    expect(layout.collapsed).toEqual(['history']);
    expect(layout.hidden).toEqual(['layers']);
  });

  it('normalize: non-object input falls back to the default layout', () => {
    expect(normalizePanelLayout(null)).toEqual(defaultPanelLayout());
    expect(normalizePanelLayout('garbage')).toEqual(defaultPanelLayout());
    expect(normalizePanelLayout(42)).toEqual(defaultPanelLayout());
  });

  it('normalize: non-array collapsed/hidden are treated as empty', () => {
    const layout = normalizePanelLayout({ collapsed: 'x', hidden: { a: 1 } });
    expect(layout.collapsed).toEqual([]);
    expect(layout.hidden).toEqual([]);
  });
});
