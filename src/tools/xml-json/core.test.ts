import { describe, expect, it } from 'vitest';
import { xmlToJson } from './core';

describe('xmlToJson', () => {
  it('空输入 EMPTY', () => {
    expect(xmlToJson('  ')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('解析元素与属性', () => {
    const r = xmlToJson('<root a="1"><item>x</item></root>');
    expect(r.ok).toBe(true);
    if (r.ok) {
      const obj = JSON.parse(r.value);
      expect(obj.root['@_a']).toBe('1');
      expect(obj.root.item).toBe('x');
    }
  });

  it('非法文本 PARSE', () => {
    expect(xmlToJson('not xml')).toEqual({ ok: false, error: 'PARSE' });
  });

  it('4 空格缩进', () => {
    const r = xmlToJson('<a/>', 4);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatch(/\n {4}/);
  });
});
