import { describe, expect, it } from 'vitest';
import { parseUserAgent } from './core';

describe('ua-parser', () => {
  it('解析 Chrome macOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const r = parseUserAgent(ua);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.browser.name).toBe('Chrome');
    expect(r.value.os.name).toBe('macOS');
    expect(r.value.engine.name).toBe('Blink');
  });

  it('空输入', () => {
    expect(parseUserAgent('   ')).toEqual({ ok: false, error: 'EMPTY' });
  });
});
