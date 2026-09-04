import { describe, expect, it } from 'vitest';
import { generateRandomStrings, resolveCharset } from './core';

describe('random-string', () => {
  it('hex 长度与字符集', () => {
    const r = generateRandomStrings({ length: 8, count: 3, preset: 'hex', custom: '' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(3);
    for (const s of r.value) {
      expect(s).toHaveLength(8);
      expect(s).toMatch(/^[0-9a-f]+$/);
    }
  });

  it('自定义字符集去重', () => {
    expect(resolveCharset('custom', 'aab')).toBe('ab');
  });

  it('空字符集', () => {
    expect(generateRandomStrings({ length: 4, count: 1, preset: 'custom', custom: '' })).toEqual({
      ok: false,
      error: 'EMPTY_CHARSET',
    });
  });
});
