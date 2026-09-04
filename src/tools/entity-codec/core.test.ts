import { describe, expect, it } from 'vitest';
import { decodeEntities, encodeEntities } from './core';

const okEncode = (
  text: string,
  mode: 'named' | 'decimal' | 'hex' | 'unicode',
  scope?: 'special' | 'nonascii',
) => {
  const result = encodeEntities(text, mode, scope);
  expect(result.ok).toBe(true);
  return result.ok ? result.value : '';
};

describe('encodeEntities', () => {
  it('named + special：仅编码特殊字符，优先命名实体', () => {
    expect(okEncode('<div class="a">&\'', 'named')).toBe(
      '&lt;div class=&quot;a&quot;&gt;&amp;&apos;',
    );
    expect(okEncode('中文', 'named')).toBe('中文'); // special 范围不动非 ASCII
  });

  it('named + nonascii：无命名实体的字符回退十进制', () => {
    expect(okEncode('中', 'named', 'nonascii')).toBe('&#20013;');
    expect(okEncode('©', 'named', 'nonascii')).toBe('&copy;');
  });

  it('decimal 模式', () => {
    expect(okEncode('&', 'decimal')).toBe('&#38;');
    expect(okEncode('A', 'decimal')).toBe('A');
    expect(okEncode('中', 'decimal', 'nonascii')).toBe('&#20013;');
  });

  it('hex 模式：大写十六进制', () => {
    expect(okEncode('&', 'hex')).toBe('&#x26;');
    expect(okEncode('中', 'hex', 'nonascii')).toBe('&#x4E2D;');
  });

  it('unicode 模式：BMP 与增补平面（代理对）', () => {
    expect(okEncode('中', 'unicode', 'nonascii')).toBe('\\u4E2D');
    expect(okEncode('😀', 'unicode', 'nonascii')).toBe('\\uD83D\\uDE00');
  });

  it('空输入返回空字符串', () => {
    expect(okEncode('', 'named')).toBe('');
  });
});

describe('decodeEntities', () => {
  it('混合解码：命名 + 十进制 + 十六进制 + \\u 转义', () => {
    const result = decodeEntities('&lt;b&gt;&#65;&#x42;\\u0041&amp;');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.output).toBe('<b>ABA&');
    expect(result.value.unknown).toEqual([]);
  });

  it('增补平面：十进制与 \\u 代理对均可还原', () => {
    const dec = decodeEntities('&#128512;');
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    expect(dec.value.output).toBe('😀');
    const surrogate = decodeEntities('\\uD83D\\uDE00');
    expect(surrogate.ok && surrogate.value.output).toBe('😀');
  });

  it('未识别的命名实体原样保留并列出（去重）', () => {
    const result = decodeEntities('&foo; and &foo; and &bar;');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.output).toBe('&foo; and &foo; and &bar;');
    expect(result.value.unknown).toEqual(['&foo;', '&bar;']);
  });

  it('超码点范围与非法数字实体原样保留', () => {
    const result = decodeEntities('&#x110000;');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.output).toBe('&#x110000;');
  });

  it('编解码往返一致（nonascii + decimal）', () => {
    const source = 'SynTools 工具集 <v1> & "quotes" 😀';
    const encoded = encodeEntities(source, 'decimal', 'nonascii');
    const decoded = decodeEntities(encoded.ok ? encoded.value : '');
    expect(decoded.ok && decoded.value.output).toBe(source);
  });

  it('空输入', () => {
    const result = decodeEntities('');
    expect(result.ok && result.value.output).toBe('');
  });
});
