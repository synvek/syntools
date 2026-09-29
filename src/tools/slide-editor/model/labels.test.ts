import { describe, expect, it } from 'vitest';
import { slideStrings } from '../strings';
import { CHART_TYPES } from './chart';
import { SHAPE_PRESETS } from './shapes';

/**
 * 插入面板的标签门禁。
 *
 * 图表类型与形状库曾经把中文写死在模型里，英文界面会显示中文。
 * 现在统一走 `tools.slide.*` 的 i18n 键，这条测试保证新增类型/形状时
 * 不会忘记补文案（缺键时 i18next 只会静默回落成原始 key）。
 */

function flatKeys(tree: unknown, prefix = ''): string[] {
  if (!tree || typeof tree !== 'object') return prefix ? [prefix] : [];
  const keys: string[] = [];
  for (const [key, value] of Object.entries(tree as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') keys.push(...flatKeys(value, path));
    else keys.push(path);
  }
  return keys;
}

describe('插入面板标签 i18n', () => {
  const required = [
    ...CHART_TYPES.map((item) => `tools.slide.${item.labelKey}`),
    ...SHAPE_PRESETS.map((item) => `tools.slide.${item.labelKey}`),
  ];

  it('图表类型 / 形状预设的键互不重复', () => {
    expect(new Set(required).size).toBe(required.length);
  });

  it('9 种语言都具备全部标签文案', () => {
    const languages = Object.keys(slideStrings);
    expect(languages).toHaveLength(9);
    const missing: string[] = [];
    for (const language of languages) {
      const keys = new Set(flatKeys(slideStrings[language]));
      for (const key of required) {
        if (!keys.has(key)) missing.push(`${language}:${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('形状预设的 prst 名互不重复', () => {
    const presets = SHAPE_PRESETS.map((item) => item.prst);
    expect(new Set(presets).size).toBe(presets.length);
  });
});
