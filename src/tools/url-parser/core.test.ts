import { describe, expect, it } from 'vitest';
import { parseUrl } from './core';

describe('parseUrl', () => {
  it('拆解标准 URL', () => {
    const result = parseUrl('https://user:pass@example.com:8443/a/b?x=1&y=2#top');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.protocol).toBe('https:');
    expect(result.value.hostname).toBe('example.com');
    expect(result.value.port).toBe('8443');
    expect(result.value.pathname).toBe('/a/b');
    expect(result.value.username).toBe('user');
    expect(result.value.password).toBe('pass');
    expect(result.value.hash).toBe('#top');
    expect(result.value.isSecure).toBe(true);
    expect(result.value.params).toEqual([
      { key: 'x', value: '1' },
      { key: 'y', value: '2' },
    ]);
    expect(result.value.segments).toEqual(['a', 'b']);
  });

  it('为缺少协议的输入补全 https', () => {
    const result = parseUrl('example.com/path');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.protocol).toBe('https:');
    expect(result.value.pathname).toBe('/path');
  });

  it('识别 IP 形态主机', () => {
    const v4 = parseUrl('http://127.0.0.1:3000/');
    expect(v4.ok && v4.value.isIpHost).toBe(true);
    const v6 = parseUrl('http://[::1]:8080/');
    expect(v6.ok && v6.value.isIpHost).toBe(true);
    const host = parseUrl('https://example.com');
    expect(host.ok && host.value.isIpHost).toBe(false);
  });

  it('拒绝空输入', () => {
    expect(parseUrl('')).toEqual({ ok: false, error: 'EMPTY' });
  });
});
