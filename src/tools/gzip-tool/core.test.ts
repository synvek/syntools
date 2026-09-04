import { describe, expect, it } from 'vitest';
import { gzipCompress, gzipDecompress } from './core';

describe('gzip-tool', () => {
  it('空输入 EMPTY', () => {
    expect(gzipCompress('')).toEqual({ ok: false, error: 'EMPTY' });
    expect(gzipDecompress('')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('压缩再解压', () => {
    const enc = gzipCompress('hello gzip 你好');
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    expect(gzipDecompress(enc.value)).toEqual({ ok: true, value: 'hello gzip 你好' });
  });

  it('非法 base64', () => {
    expect(gzipDecompress('!!!')).toEqual({ ok: false, error: 'INVALID' });
  });

  it('非法 gzip 载荷', () => {
    expect(gzipDecompress(btoa('not-gzip'))).toEqual({ ok: false, error: 'DECOMPRESS_FAILED' });
  });

  it('压缩结果为 base64', () => {
    const enc = gzipCompress('abc');
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    expect(() => atob(enc.value)).not.toThrow();
  });
});
