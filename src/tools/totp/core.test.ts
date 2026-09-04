import { describe, expect, it } from 'vitest';
import { decodeBase32, generateTotp, verifyTotp } from './core';

// RFC 6238 Appendix B seed "12345678901234567890" in base32
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('totp', () => {
  it('空密钥 EMPTY', async () => {
    expect(await generateTotp('')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('非法 base32 INVALID_SECRET', async () => {
    expect(await generateTotp('!!!!')).toEqual({ ok: false, error: 'INVALID_SECRET' });
  });

  it('decodeBase32 成功', () => {
    const r = decodeBase32('MFRGG');
    expect(r.ok).toBe(true);
  });

  it('RFC 向量 epoch 59 → 94287082 (8 digits)', async () => {
    const r = await generateTotp(SECRET, 8, 59 * 1000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.code).toBe('94287082');
  });

  it('verify 当前码成功', async () => {
    const now = Date.now();
    const gen = await generateTotp(SECRET, 6, now);
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;
    const v = await verifyTotp(SECRET, gen.value.code, 6, now);
    expect(v).toEqual({ ok: true, value: true });
  });
});
