import { describe, expect, it } from 'vitest';
import { richTextStrings } from './strings';

/** RTE-05 收尾：确认 9 种语言的键完全对齐（增量块合并后不能有漏译） */

const LANGS = ['zh', 'en', 'zh-TW', 'ja', 'fr', 'de', 'it', 'es', 'pt'] as const;

function flattenKeys(tree: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') {
      keys.push(...flattenKeys(value as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function valueOf(tree: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((node, part) => {
    if (!node || typeof node !== 'object') return undefined;
    return (node as Record<string, unknown>)[part];
  }, tree);
}

const BASE_KEYS = flattenKeys(richTextStrings.zh.tools.richText as Record<string, unknown>);

describe('富文本文案对齐', () => {
  it('九种语言都在表里', () => {
    expect(Object.keys(richTextStrings).sort()).toEqual([...LANGS].sort());
  });

  it('每种语言的键与中文完全一致（不多不少）', () => {
    const base = new Set(BASE_KEYS);
    expect(BASE_KEYS.length).toBeGreaterThan(100);
    for (const lng of LANGS) {
      const keys = new Set(
        flattenKeys(richTextStrings[lng].tools.richText as Record<string, unknown>),
      );
      const missing = [...base].filter((key) => !keys.has(key)).map((key) => `${lng}:${key}`);
      const extra = [...keys].filter((key) => !base.has(key)).map((key) => `${lng}:${key}`);
      expect(missing).toEqual([]);
      expect(extra).toEqual([]);
    }
  });

  it('没有空文案', () => {
    for (const lng of LANGS) {
      const empty = BASE_KEYS.filter((key) => {
        const value = valueOf(richTextStrings[lng].tools.richText as Record<string, unknown>, key);
        return typeof value !== 'string' || value.trim() === '';
      });
      expect({ lng, empty }).toEqual({ lng, empty: [] });
    }
  });

  it('RTE-05 的四个新键已经落到每种语言', () => {
    const added = ['smallCaps', 'indentLeftIncrease', 'indentLeftDecrease', 'hangingIndent'];
    for (const lng of LANGS) {
      const tree = richTextStrings[lng].tools.richText as Record<string, unknown>;
      const missing = added.filter((key) => {
        const value = tree[key];
        return typeof value !== 'string' || value.trim() === '';
      });
      expect({ lng, missing }).toEqual({ lng, missing: [] });
    }
  });
});
