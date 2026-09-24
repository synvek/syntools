import { describe, expect, it } from 'vitest';
import { atbash, caesar, railFence, railFenceDecode, rot13 } from './core';

describe('caesar / rot13 / atbash', () => {
  it('凯撒位移', () => {
    expect(caesar('abc', 1)).toBe('bcd');
    expect(caesar('XYZ', 1)).toBe('YZA');
    expect(caesar('a', 26)).toBe('a');
  });
  it('ROT13 自反', () => {
    expect(rot13('ABC')).toBe('NOP');
    expect(rot13(rot13('Hello'))).toBe('Hello');
  });
  it('Atbash 自反', () => {
    expect(atbash('ABC')).toBe('ZYX');
    expect(atbash(atbash('Hello'))).toBe('Hello');
  });
});

describe('rail fence', () => {
  it('加密后可解密还原', () => {
    const text = 'HELLOWORLD';
    const enc = railFence(text, 3);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const dec = railFenceDecode(enc.value, 3);
    expect(dec).toEqual({ ok: true, value: text });
  });
  it('rails < 2 报错', () => {
    expect(railFence('x', 1)).toEqual({ ok: false, error: 'RAILS_TOO_SMALL' });
    expect(railFenceDecode('x', 1)).toEqual({ ok: false, error: 'RAILS_TOO_SMALL' });
  });
});
