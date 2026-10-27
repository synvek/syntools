import { describe, expect, it } from 'vitest';
import { slideStrings } from './strings';

/**
 * Locale consistency gate.
 *
 * This project registers tool copy inside a lazy-loaded chunk with all 9 languages kept in sync,
 * but until now there was **no enforcement** (no validation script, no lint, no CI step): a missing
 * key was silently absorbed by i18next's fallbackLng, and mixed Chinese/English UI was hard to spot.
 * This unit test turns the convention into a gate at minimal cost.
 */

function flattenKeys(tree: unknown, prefix = ''): string[] {
  if (!tree || typeof tree !== 'object') return prefix ? [prefix] : [];
  const keys: string[] = [];
  for (const [key, value] of Object.entries(tree as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') keys.push(...flattenKeys(value, path));
    else keys.push(path);
  }
  return keys;
}

describe('幻灯片工具语言包一致性', () => {
  const reference = flattenKeys(slideStrings.zh).sort();
  const languages = Object.keys(slideStrings);

  it('覆盖全部 9 种语言', () => {
    // Note: Traditional Chinese's i18n code is 'zh-TW' (matching core/i18n/locales/zh-TW.ts)
    expect([...languages].sort()).toEqual([
      'de',
      'en',
      'es',
      'fr',
      'it',
      'ja',
      'pt',
      'zh',
      'zh-TW',
    ]);
  });

  it('基准语言 zh 自身无重复键', () => {
    const all = flattenKeys(slideStrings.zh);
    expect(all.length).toBe(new Set(all).size);
  });

  for (const language of languages.filter((lng) => lng !== 'zh')) {
    it(`${language} 的文案键与 zh 完全一致`, () => {
      const keys = flattenKeys(slideStrings[language]);
      const missing = reference.filter((key) => !keys.includes(key));
      const extra = keys.filter((key) => !reference.includes(key));
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });
  }

  it('没有空字符串文案（占位但未翻译）', () => {
    const empties: string[] = [];
    for (const language of languages) {
      const walk = (tree: unknown, prefix: string) => {
        if (!tree || typeof tree !== 'object') return;
        for (const [key, value] of Object.entries(tree as Record<string, unknown>)) {
          const path = prefix ? `${prefix}.${key}` : key;
          if (typeof value === 'string') {
            if (value.trim() === '') empties.push(`${language}.${path}`);
          } else {
            walk(value, path);
          }
        }
      };
      walk(slideStrings[language], '');
    }
    expect(empties).toEqual([]);
  });
});
