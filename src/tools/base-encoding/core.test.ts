import { describe, expect, it } from 'vitest';
import { decodeBase, encodeBase, type BaseAlphabet } from './core';

const ALPHABETS: BaseAlphabet[] = [
  'base16',
  'base32',
  'base32hex',
  'base64',
  'base64url',
  'base58',
];

describe('base encoding roundtrips', () => {
  for (const a of ALPHABETS) {
    it(`${a} 编码后解码还原`, () => {
      const text = 'Hello, 世界! 123';
      const enc = encodeBase(a, text);
      expect(enc.ok).toBe(true);
      if (!enc.ok) return;
      const dec = decodeBase(a, enc.value);
      expect(dec).toEqual({ ok: true, value: text });
    });
  }

  it('base64 与 base64url 互通', () => {
    const enc = encodeBase('base64', 'SynTools');
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const url = enc.value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeBase('base64url', url)).toEqual({ ok: true, value: 'SynTools' });
  });
});

describe('base decoding errors', () => {
  it('空输入报错', () => {
    expect(decodeBase('base64', '   ')).toEqual({ ok: false, error: 'EMPTY' });
  });
  it('base32 非法字符报错', () => {
    expect(decodeBase('base32', '18@@').ok).toBe(false);
  });
});
