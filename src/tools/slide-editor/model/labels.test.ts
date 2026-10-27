import { describe, expect, it } from 'vitest';
import { slideStrings } from '../strings';
import { CHART_TYPES } from './chart';
import { SHAPE_PRESETS } from './shapes';

/**
 * Insert-panel label gate.
 *
 * Chart types and the shape library used to hardcode Chinese in the model, so English UIs showed Chinese.
 * They now go through `tools.slide.*` i18n keys, and this test makes sure new types/shapes come with copy
 * (a missing key silently falls back to the raw key in i18next).
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
