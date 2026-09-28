import { describe, expect, it } from 'vitest';
import { slideStrings } from './strings';

/**
 * 语言包一致性门禁。
 *
 * 本项目对工具文案采用的是「懒加载 chunk 内注册、9 语言同步补齐」的约定，
 * 但此前**没有任何强制机制**（无校验脚本、无 lint、无 CI 步骤），
 * 缺 key 只会被 i18next 的 fallbackLng 静默兜住，界面出现中英混杂也很难被发现。
 * 这条单测用最低成本把该约定变成门禁。
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
    // 注意：繁体中文的 i18n 语言码是 'zh-TW'（与 core/i18n/locales/zh-TW.ts 一致）
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
