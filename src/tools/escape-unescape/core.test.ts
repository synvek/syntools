import { describe, expect, it } from 'vitest';
import { escapeText, unescapeText, type EscapeKind } from './core';

const KINDS: EscapeKind[] = ['json', 'js', 'html', 'xml', 'url'];

describe('escape / unescape roundtrips', () => {
  for (const k of KINDS) {
    it(`${k} 转义后可还原`, () => {
      const text = 'a<b>"&\' 世界';
      const escaped = escapeText(text, k);
      expect(unescapeText(escaped, k)).toBe(text);
    });
  }
});

describe('specific escaping', () => {
  it('HTML 转义尖括号与引号', () => {
    expect(escapeText('a&<', 'html')).toBe('a&amp;&lt;');
    expect(unescapeText('a&amp;&lt;', 'html')).toBe('a&<');
  });
  it('URL 编码空格', () => {
    expect(escapeText('a b', 'url')).toBe('a%20b');
    expect(unescapeText('a%20b', 'url')).toBe('a b');
  });
  it('JSON 加引号', () => {
    expect(escapeText('x', 'json')).toBe('"x"');
    expect(unescapeText('"x"', 'json')).toBe('x');
  });
});
