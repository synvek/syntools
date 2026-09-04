import { describe, expect, it } from 'vitest';
import { decodeUnicode, encodeUnicode, processUnicode } from './core';

describe('unicode-codec', () => {
  it('编码为 \\uXXXX', () => {
    expect(encodeUnicode('A中', 'js')).toBe('\\u0041\\u4e2d');
  });

  it('编码为码点', () => {
    expect(encodeUnicode('中', 'codePoint')).toBe('U+4E2D');
  });

  it('编码 emoji 为 \\u{…}', () => {
    expect(encodeUnicode('😀', 'jsBrace')).toBe('\\u{1f600}');
  });

  it('解码 \\u 与实体', () => {
    const r = decodeUnicode('\\u4e2d&#x41;');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBe('中A');
  });

  it('解码 UTF-8 字节', () => {
    const r = decodeUnicode('E4 B8 AD');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBe('中');
  });

  it('空输入', () => {
    expect(processUnicode('', 'encode', 'js')).toEqual({ ok: false, error: 'EMPTY' });
  });
});
