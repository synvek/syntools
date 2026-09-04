import { describe, expect, it } from 'vitest';
import { parseUrl, rebuildUrl } from './core';

describe('url-query', () => {
  it('空输入 EMPTY', () => {
    expect(parseUrl('')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('非法 URL', () => {
    expect(parseUrl('not a url')).toEqual({ ok: false, error: 'INVALID_URL' });
  });

  it('解析 query', () => {
    const r = parseUrl('https://example.com/path?a=1&b=hello%20world#hash');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.hostname).toBe('example.com');
    expect(r.value.pathname).toBe('/path');
    expect(r.value.query).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: 'hello world' },
    ]);
  });

  it('重建 URL', () => {
    const r = rebuildUrl('https://example.com/x?old=1', [
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toContain('a=1');
    expect(r.value).toContain('b=2');
    expect(r.value).not.toContain('old=');
  });

  it('重建空基址 EMPTY', () => {
    expect(rebuildUrl('', [])).toEqual({ ok: false, error: 'EMPTY' });
  });
});
