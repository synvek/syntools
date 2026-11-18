import { describe, expect, it } from 'vitest';
import { pdfEditorStrings } from './strings';

/**
 * Locale consistency gate (same contract as slide-editor / rich-text-editor).
 *
 * Tool copy is registered lazily and i18next's fallback would silently absorb a missing key,
 * showing mixed Chinese/English UI. This test turns the convention into a build-time gate.
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

describe('PDF 编辑器语言包一致性', () => {
  const reference = flattenKeys(pdfEditorStrings.zh).sort();
  const languages = Object.keys(pdfEditorStrings);

  it('覆盖全部 9 种语言', () => {
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
    const all = flattenKeys(pdfEditorStrings.zh);
    expect(all.length).toBe(new Set(all).size);
  });

  for (const language of languages.filter((lng) => lng !== 'zh')) {
    it(`${language} 的文案键与 zh 完全一致`, () => {
      const keys = flattenKeys(pdfEditorStrings[language]);
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
      walk(pdfEditorStrings[language], '');
    }
    expect(empties).toEqual([]);
  });

  it('key 路径统一挂在 tools.pdfEditor 下', () => {
    for (const language of languages) {
      expect(Object.keys(pdfEditorStrings[language])).toEqual(['tools']);
      expect(Object.keys(pdfEditorStrings[language].tools)).toEqual(['pdfEditor']);
    }
  });
});
