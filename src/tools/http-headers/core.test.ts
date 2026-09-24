import { describe, expect, it } from 'vitest';
import { buildHeaders, DEFAULT_OPTIONS, renderHeaders } from './core';

describe('buildHeaders', () => {
  it('默认选项产出核心安全头', () => {
    const headers = buildHeaders(DEFAULT_OPTIONS);
    const map = new Map(headers);
    expect(map.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
    expect(map.get('X-Frame-Options')).toBe('DENY');
    expect(map.get('X-Content-Type-Options')).toBe('nosniff');
    expect(map.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(map.has('Content-Security-Policy')).toBe(true);
  });

  it('关闭开关后不再输出对应头', () => {
    const headers = buildHeaders({
      ...DEFAULT_OPTIONS,
      hsts: false,
      csp: false,
      contentTypeOptions: false,
      permissionsPolicy: false,
      frameOptions: 'none',
    });
    const names = headers.map(([k]) => k);
    expect(names).not.toContain('Strict-Transport-Security');
    expect(names).not.toContain('Content-Security-Policy');
    expect(names).not.toContain('X-Content-Type-Options');
    expect(names).not.toContain('Permissions-Policy');
    expect(names).not.toContain('X-Frame-Options');
  });

  it('HSTS 可附加 preload', () => {
    const headers = buildHeaders({ ...DEFAULT_OPTIONS, preload: true, hstsMaxAge: 600 });
    expect(new Map(headers).get('Strict-Transport-Security')).toBe(
      'max-age=600; includeSubDomains; preload',
    );
  });

  it('COOP / COEP 与 CORS 按需输出', () => {
    const headers = buildHeaders({
      ...DEFAULT_OPTIONS,
      coop: 'same-origin-allow-popups',
      coep: 'require-corp',
      corsOrigin: 'https://example.com',
    });
    const map = new Map(headers);
    expect(map.get('Cross-Origin-Opener-Policy')).toBe('same-origin-allow-popups');
    expect(map.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
    expect(map.get('Access-Control-Allow-Origin')).toBe('https://example.com');
  });
});

describe('renderHeaders', () => {
  it('渲染 nginx 片段', () => {
    const out = renderHeaders(DEFAULT_OPTIONS, 'nginx');
    expect(out).toContain('add_header X-Frame-Options "DENY" always;');
  });

  it('渲染 vercel JSON', () => {
    const out = renderHeaders(DEFAULT_OPTIONS, 'vercel');
    const parsed = JSON.parse(out) as { headers: Array<{ headers: string[][] }> };
    expect(parsed.headers[0].headers.length).toBeGreaterThan(0);
  });

  it('渲染 express 中间件', () => {
    const out = renderHeaders(DEFAULT_OPTIONS, 'express');
    expect(out).toContain("res.setHeader('X-Content-Type-Options', 'nosniff');");
  });

  it('渲染原始头文本', () => {
    const out = renderHeaders(DEFAULT_OPTIONS, 'raw');
    expect(out.split('\n')[0]).toMatch(/^Strict-Transport-Security: /);
  });
});
