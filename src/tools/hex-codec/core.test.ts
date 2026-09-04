import { describe, expect, it } from 'vitest';
import { decodeHex, encodeHex } from './core';

describe('hex-codec', () => {
  it('空输入 EMPTY', () => {
    expect(encodeHex('')).toEqual({ ok: false, error: 'EMPTY' });
    expect(decodeHex('')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('编码 UTF-8', () => {
    expect(encodeHex('Hi')).toEqual({ ok: true, value: '4869' });
  });

  it('带空格编码', () => {
    expect(encodeHex('Hi', true)).toEqual({ ok: true, value: '48 69' });
  });

  it('解码忽略空格', () => {
    expect(decodeHex('48 69')).toEqual({ ok: true, value: 'Hi' });
  });

  it('非法 hex', () => {
    expect(decodeHex('zzz')).toEqual({ ok: false, error: 'INVALID_HEX' });
    expect(decodeHex('abc')).toEqual({ ok: false, error: 'INVALID_HEX' });
  });
});
