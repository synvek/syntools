import { describe, expect, it } from 'vitest';
import { LASSO_CYCLE, RETOUCH_CYCLE, TOOL_SHORTCUTS } from './interaction/keyboard';
import { ALL_TOOLS, TOOL_GROUPS, displayToolOf, groupOfTool } from './toolset';
import type { ToolId } from './model/types';

/**
 * Guard consistency between the toolbox badges and the real key bindings.
 * Historic bug: the ellipse-marquee badge said O but no key was bound. Users almost never report that kind of
 * mismatch, so only tests can catch it.
 */

/** Combo badge → tools inside that group (⇧O / ⇧I are cycle groups) */
const COMBO_SHORTCUTS: Record<string, ToolId[]> = {
  '⌘T': ['transform'],
  '⇧G': ['fill'],
  '⇧O': RETOUCH_CYCLE,
  '⇧I': ['eyedropper', 'sampler'],
  '⇧J': ['healing', 'spotHeal'],
  '⇧R': ['blurBrush', 'sharpenBrush'],
  '⇧L': LASSO_CYCLE,
};

describe('toolset', () => {
  it('each tool appears in exactly one group, with a unique id', () => {
    const ids = ALL_TOOLS.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every tool has a badge and a copy key', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.shortcut.length).toBeGreaterThan(0);
      expect(tool.labelKey.startsWith('tools.photo.')).toBe(true);
    }
  });

  it('single-letter badges must match the key bindings', () => {
    for (const tool of ALL_TOOLS) {
      if (!/^[A-Z]$/.test(tool.shortcut)) continue;
      expect(TOOL_SHORTCUTS[tool.shortcut.toLowerCase()]).toBe(tool.id);
    }
  });

  it('combo badges must fall inside an implemented combo group', () => {
    for (const tool of ALL_TOOLS) {
      if (/^[A-Z]$/.test(tool.shortcut)) continue;
      const group = COMBO_SHORTCUTS[tool.shortcut];
      expect(group, `未登记的组合键角标：${tool.shortcut}`).toBeDefined();
      expect(group).toContain(tool.id);
    }
  });

  it('every key-bound tool exists in the toolbox (no hidden tools)', () => {
    const ids = new Set<ToolId>(ALL_TOOLS.map((tool) => tool.id));
    for (const id of Object.values(TOOL_SHORTCUTS)) expect(ids.has(id)).toBe(true);
    for (const id of RETOUCH_CYCLE) expect(ids.has(id)).toBe(true);
  });

  it('group ids are unique', () => {
    const groups = TOOL_GROUPS.map((group) => group.id);
    expect(new Set(groups).size).toBe(groups.length);
  });
});

/**
 * The two invariants of toolbox grouping.
 *
 * Grouping is not just cosmetic: flattened, the 26 tools make the left rail about 1100 px tall, and as the
 * tallest element in the flex row it stretches the whole workspace and the canvas with it (the page can only
 * scroll), so these tests guard both "grouping is complete" and "never flat again".
 */
describe('Toolbox grouping', () => {
  it('each group contains its primary tool', () => {
    for (const group of TOOL_GROUPS) {
      expect(group.items.map((item) => item.id)).toContain(group.primary);
    }
  });

  it('every tool belongs to exactly one group (a new tool without a group fails here)', () => {
    // The shape group is "one tool + several variants", so dedupe by (id, variant)
    const keys = TOOL_GROUPS.flatMap((group) =>
      group.items.map((item) => `${item.id}:${item.variant ?? ''}`),
    );
    expect(new Set(keys).size).toBe(keys.length);
    const ids = [...new Set(TOOL_GROUPS.flatMap((group) => group.items.map((item) => item.id)))];
    expect(ids.sort()).toEqual(ALL_TOOLS.map((tool) => tool.id).sort());
  });

  it('groups cover every tool (looking one up by tool id never comes back empty)', () => {
    for (const tool of ALL_TOOLS) expect(groupOfTool(tool.id)?.id).toBeTruthy();
  });

  it('the row count never returns to flat (otherwise the left rail grows past 1000 px again)', () => {
    expect(TOOL_GROUPS.length).toBeLessThanOrEqual(16);
    expect(ALL_TOOLS.length).toBeGreaterThan(TOOL_GROUPS.length);
  });

  it('high-frequency tools get their own rows; healing brush and spot healing share one', () => {
    for (const id of ['brush', 'eraser', 'cloneStamp', 'text']) {
      expect(groupOfTool(id as ToolId)?.items).toHaveLength(1);
    }
    expect(groupOfTool('healing')?.id).toBe(groupOfTool('spotHeal')?.id);
    expect(groupOfTool('healing')?.items.map((item) => item.id)).toEqual(['healing', 'spotHeal']);
  });

  it('the three lasso tools form a group; wand and quick select form another', () => {
    expect(groupOfTool('lasso')?.items.map((item) => item.id)).toEqual([
      'lasso',
      'polyLasso',
      'magneticLasso',
    ]);
    expect(groupOfTool('wand')?.items.map((item) => item.id)).toEqual(['wand', 'quickSelect']);
    // The two groups get their own rows (the wand is no longer squeezed into the lasso group)
    expect(groupOfTool('polyLasso')?.id).toBe('lasso');
    expect(groupOfTool('quickSelect')?.id).toBe('wand');
    expect(new Set(groupOfTool('wand')?.items.map((item) => item.icon)).size).toBe(2);
  });

  it('shape is one tool with six variants: a single row, variants split in the flyout', () => {
    const shape = groupOfTool('shape');
    expect(shape?.items).toHaveLength(6);
    expect(new Set(shape?.items.map((item) => item.id))).toEqual(new Set(['shape']));
    expect(shape?.items.map((item) => item.variant)).toEqual([
      'rect',
      'roundRect',
      'ellipse',
      'line',
      'arrow',
      'star',
    ]);
    // Every variant has its own icon (they used to all share the generic shapes icon)
    expect(new Set(shape?.items.map((item) => item.icon)).size).toBe(6);
    // Which item is shown depends on the current variant
    expect(displayToolOf(shape!, 'shape', 'ellipse').variant).toBe('ellipse');
    expect(displayToolOf(shape!, 'shape').variant).toBe('rect');
  });

  it('displayToolOf: shows the group last used tool, otherwise the primary', () => {
    const heal = TOOL_GROUPS.find((group) => group.id === 'heal');
    const blur = TOOL_GROUPS.find((group) => group.id === 'blur');
    expect(heal).toBeDefined();
    expect(blur).toBeDefined();
    // Current tool is not in this group: show the group's primary tool
    expect(displayToolOf(heal!, 'move').id).toBe(heal!.primary);
    // Current tool is in this group: show it (remember the user's last choice)
    expect(displayToolOf(heal!, 'spotHeal').id).toBe('spotHeal');
    expect(displayToolOf(blur!, 'sharpenBrush').id).toBe('sharpenBrush');
  });

  it('groups of one section stay contiguous (dividers are drawn only between sections, or lines repeat)', () => {
    const sections = TOOL_GROUPS.map((group) => group.section);
    const seen = new Set<string>();
    let previous = '';
    for (const section of sections) {
      if (section === previous) continue;
      expect(seen.has(section)).toBe(false);
      seen.add(section);
      previous = section;
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('single-tool groups expand to nothing (the flyout badge only appears on multi-tool groups)', () => {
    const crop = TOOL_GROUPS.find((group) => group.id === 'crop');
    const nav = TOOL_GROUPS.find((group) => group.id === 'nav');
    expect(crop?.items).toHaveLength(1);
    expect(nav?.items).toHaveLength(1);
  });
});
