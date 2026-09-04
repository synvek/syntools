import { describe, expect, it } from 'vitest';
import { decodeX509 } from './core';

// Minimal self-contained PEM: SEQUENCE with short DER (not a real cert, but valid PEM→DER)
const MIN_PEM = `-----BEGIN CERTIFICATE-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Z3VS5JJcds3xfn/ygWy
F1PPIWGJtDVLAvVjJp5sR0xN1O/0lLcGYgGFzYl9uX9n1QIDAQAB
-----END CERTIFICATE-----`;

describe('x509-decode', () => {
  it('空输入 EMPTY', async () => {
    expect(await decodeX509('')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('非法 PEM', async () => {
    expect(await decodeX509('not pem')).toEqual({ ok: false, error: 'INVALID_PEM' });
  });

  it('解析类型与指纹', async () => {
    const r = await decodeX509(MIN_PEM);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.pemType).toBe('CERTIFICATE');
    expect(r.value.derLength).toBeGreaterThan(0);
    expect(r.value.sha256).toHaveLength(64);
    expect(r.value.sha1).toHaveLength(40);
  });

  it('指纹稳定', async () => {
    const a = await decodeX509(MIN_PEM);
    const b = await decodeX509(MIN_PEM);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value.sha256).toBe(b.value.sha256);
  });

  it('BEGIN/END 类型不一致失败', async () => {
    const bad = MIN_PEM.replace('END CERTIFICATE', 'END X509');
    expect(await decodeX509(bad)).toEqual({ ok: false, error: 'INVALID_PEM' });
  });
});
