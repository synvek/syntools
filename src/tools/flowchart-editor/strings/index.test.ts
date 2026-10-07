import { describe, expect, it } from 'vitest';
import { SHAPE_LABELS } from '../model/types';
import {
  FLOWCHART_LANGS,
  __resetFlowchartStrings,
  hasFlowchartStrings,
  registerFlowchartStrings,
  resolveFlowchartLang,
} from './index';
import type { ResourceTree } from './types';

function fakeI18n(language = 'zh') {
  const bundles: Record<string, ResourceTree> = {};
  let calls = 0;
  return {
    language,
    bundles,
    get calls() {
      return calls;
    },
    addResourceBundle(lng: string, _ns: string, resources: ResourceTree) {
      calls += 1;
      bundles[lng] = resources;
    },
  };
}

function keysOf(tree: ResourceTree): string[] {
  return Object.keys(tree.tools.flowchart);
}

describe('文案按语种懒加载', () => {
  it('覆盖 9 个语种', () => {
    expect(FLOWCHART_LANGS).toHaveLength(9);
    expect(FLOWCHART_LANGS).toContain('zh-TW');
  });

  it('语言归一化：精确 → 主语言 → 英文回退', () => {
    expect(resolveFlowchartLang('zh-TW')).toBe('zh-TW');
    expect(resolveFlowchartLang('zh-CN')).toBe('zh');
    expect(resolveFlowchartLang('en-GB')).toBe('en');
    expect(resolveFlowchartLang('xx')).toBe('en');
    expect(resolveFlowchartLang(undefined)).toBe('en');
  });

  it('注册后合并 UI 文案、图形名与模板文案前缀', async () => {
    __resetFlowchartStrings();
    const i18n = fakeI18n('zh');
    expect(hasFlowchartStrings('zh')).toBe(false);

    const lng = await registerFlowchartStrings(i18n, 'zh');
    expect(lng).toBe('zh');
    expect(hasFlowchartStrings('zh')).toBe(true);

    const keys = keysOf(i18n.bundles.zh);
    expect(keys).toContain('panelTitle');
    expect(keys).toContain('shape_rect');
    expect(keys).toContain('tpl_start');
    expect(keys.filter((k) => k.startsWith('shape_'))).toHaveLength(
      Object.keys(SHAPE_LABELS).length,
    );
  });

  it('同一语种重复注册只执行一次', async () => {
    __resetFlowchartStrings();
    const i18n = fakeI18n('en');
    await registerFlowchartStrings(i18n, 'en');
    await registerFlowchartStrings(i18n, 'en');
    expect(i18n.calls).toBe(1);
  });

  it('每个语种都能独立加载且图形名齐全', async () => {
    const expected = Object.keys(SHAPE_LABELS).length;
    for (const lng of FLOWCHART_LANGS) {
      // 逐语种重置模块级注册缓存：每个用例使用独立的 i18n 实例
      __resetFlowchartStrings();
      const i18n = fakeI18n(lng);
      await registerFlowchartStrings(i18n, lng);
      const keys = keysOf(i18n.bundles[lng]);
      expect(keys.filter((k) => k.startsWith('shape_'))).toHaveLength(expected);
      // UI 文案不能只加载图形名/f图形名之外的少量键
      expect(keys).toContain('exportPanel');
    }
  });

  it('非英文语种同时注册英文兜底包（避免缺键显示原始键名）', async () => {
    __resetFlowchartStrings();
    const i18n = fakeI18n('ja');
    await registerFlowchartStrings(i18n, 'ja');
    expect(keysOf(i18n.bundles.ja)).toContain('transform');
    expect(keysOf(i18n.bundles.en)).toContain('transform');
    // 英文自身不额外注册第二份
    __resetFlowchartStrings();
    const en = fakeI18n('en');
    await registerFlowchartStrings(en, 'en');
    expect(en.calls).toBe(1);
  });
});
