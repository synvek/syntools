import { describe, expect, it } from 'vitest';
import { RETOUCH_CYCLE, TOOL_SHORTCUTS } from './interaction/keyboard';
import { ALL_TOOLS, TOOL_GROUPS, displayToolOf, groupOfTool } from './toolset';
import type { ToolId } from './model/types';

/**
 * 守住「工具箱角标」与「真实按键绑定」的一致性。
 * 历史缺陷：椭圆选区角标写着 O，但键盘并未绑定 —— 这类不一致用户几乎不会主动上报，
 * 只能靠测试兜住。
 */

/** 组合键角标 → 该组内的工具（⇧O / ⇧I 是循环组） */
const COMBO_SHORTCUTS: Record<string, ToolId[]> = {
  '⌘T': ['transform'],
  '⇧G': ['fill'],
  '⇧O': RETOUCH_CYCLE,
  '⇧I': ['eyedropper', 'sampler'],
  '⇧J': ['healing', 'spotHeal'],
  '⇧R': ['blurBrush', 'sharpenBrush'],
};

describe('toolset', () => {
  it('每个工具只出现在一个分组里，且 id 唯一', () => {
    const ids = ALL_TOOLS.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('每个工具都有角标与文案键', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.shortcut.length).toBeGreaterThan(0);
      expect(tool.labelKey.startsWith('tools.photo.')).toBe(true);
    }
  });

  it('单字母角标必须与键盘绑定一致', () => {
    for (const tool of ALL_TOOLS) {
      if (!/^[A-Z]$/.test(tool.shortcut)) continue;
      expect(TOOL_SHORTCUTS[tool.shortcut.toLowerCase()]).toBe(tool.id);
    }
  });

  it('组合键角标必须落在已实现的组合键分组内', () => {
    for (const tool of ALL_TOOLS) {
      if (/^[A-Z]$/.test(tool.shortcut)) continue;
      const group = COMBO_SHORTCUTS[tool.shortcut];
      expect(group, `未登记的组合键角标：${tool.shortcut}`).toBeDefined();
      expect(group).toContain(tool.id);
    }
  });

  it('键盘绑定的工具都在工具箱里（不存在隐藏工具）', () => {
    const ids = new Set<ToolId>(ALL_TOOLS.map((tool) => tool.id));
    for (const id of Object.values(TOOL_SHORTCUTS)) expect(ids.has(id)).toBe(true);
    for (const id of RETOUCH_CYCLE) expect(ids.has(id)).toBe(true);
  });

  it('分组 id 唯一', () => {
    const groups = TOOL_GROUPS.map((group) => group.id);
    expect(new Set(groups).size).toBe(groups.length);
  });
});

/**
 * 工具箱分组的两类不变式。
 *
 * 分组不只是「显示好看」：26 个工具平铺时左侧栏约 1100px 高，而它是 flex 行里最高的元素，
 * 会把整个工作区顶高、画布一起被拉长（页面只能滚动）。因此这里既守住「分组完整」，
 * 也守住「不再回到平铺」。
 */
describe('工具箱分组', () => {
  it('每组的主工具必须在组内', () => {
    for (const group of TOOL_GROUPS) {
      expect(group.items.map((item) => item.id)).toContain(group.primary);
    }
  });

  it('每个工具恰好属于一个分组（新增工具忘记分组会在这里失败）', () => {
    const grouped = TOOL_GROUPS.flatMap((group) => group.items.map((item) => item.id));
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual(ALL_TOOLS.map((tool) => tool.id).sort());
  });

  it('分组覆盖每个工具（按 tool id 反查分组不落空）', () => {
    for (const tool of ALL_TOOLS) expect(groupOfTool(tool.id)?.id).toBeTruthy();
  });

  it('行数不回到平铺（否则左侧栏会重新长到 1000px 以上）', () => {
    expect(TOOL_GROUPS.length).toBeLessThanOrEqual(16);
    expect(ALL_TOOLS.length).toBeGreaterThan(TOOL_GROUPS.length);
  });

  it('高频工具各自独立成行，修复画笔与污点修复同组', () => {
    for (const id of ['brush', 'eraser', 'cloneStamp', 'text', 'shape']) {
      expect(groupOfTool(id as ToolId)?.items).toHaveLength(1);
    }
    expect(groupOfTool('healing')?.id).toBe(groupOfTool('spotHeal')?.id);
    expect(groupOfTool('healing')?.items.map((item) => item.id)).toEqual(['healing', 'spotHeal']);
  });

  it('displayToolOf：该组用过就显示用过的，否则回落到主工具', () => {
    const heal = TOOL_GROUPS.find((group) => group.id === 'heal');
    const blur = TOOL_GROUPS.find((group) => group.id === 'blur');
    expect(heal).toBeDefined();
    expect(blur).toBeDefined();
    // 当前工具不属于该组：显示该组主工具
    expect(displayToolOf(heal!, 'move').id).toBe(heal!.primary);
    // 当前工具属于该组：显示它（记住用户上次的选择）
    expect(displayToolOf(heal!, 'spotHeal').id).toBe('spotHeal');
    expect(displayToolOf(blur!, 'sharpenBrush').id).toBe('sharpenBrush');
  });

  it('同一大区的分组必须连续（分隔线只在跨区处画，否则会出现重复线）', () => {
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

  it('单工具组没有「同组工具」可展开（浮层角标只在多工具组出现）', () => {
    const crop = TOOL_GROUPS.find((group) => group.id === 'crop');
    const nav = TOOL_GROUPS.find((group) => group.id === 'nav');
    expect(crop?.items).toHaveLength(1);
    expect(nav?.items).toHaveLength(1);
  });
});
