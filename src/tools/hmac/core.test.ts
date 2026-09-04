import { describe, expect, it } from 'vitest';
import { computeHmac } from './core';

describe('hmac', () => {
  it('空消息 EMPTY', async () => {
    expect(await computeHmac('', 'secret', 'SHA-256', 'hex')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('空密钥 INVALID_KEY', async () => {
    expect(await computeHmac('msg', '', 'SHA-256', 'hex')).toEqual({ ok: false, error: 'INVALID_KEY' });
  });

  it('SHA-256 hex 已知向量', async () => {
    const r = await computeHmac('The quick brown fox jumps over the lazy dog', 'key', 'SHA-256', 'hex');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBe('f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
  });

  it('SHA-512 输出长度 128 hex', async () => {
    const r = await computeHmac('abc', 'secret', 'SHA-512', 'hex');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(128);
  });

  it('base64 输出非空', async () => {
    const r = await computeHmac('hi', 's', 'SHA-256', 'base64');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.length).toBeGreaterThan(10);
  });
});
