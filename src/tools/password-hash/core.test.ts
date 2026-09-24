import { describe, expect, it } from 'vitest';
import { pbkdf2 } from './core';

const SALT = '00112233445566778899aabbccddeeff';

describe('password-hash (PBKDF2)', () => {
  it('空口令报错', async () => {
    expect(
      await pbkdf2({
        password: '',
        salt: SALT,
        iterations: 1000,
        hash: 'SHA-256',
        encoding: 'hex',
      }),
    ).toEqual({
      ok: false,
      error: 'EMPTY',
    });
  });

  it('迭代次数非法报错', async () => {
    expect(
      await pbkdf2({ password: 'x', salt: SALT, iterations: 0, hash: 'SHA-256', encoding: 'hex' }),
    ).toEqual({
      ok: false,
      error: 'INVALID_ITERS',
    });
  });

  it('固定盐可复现', async () => {
    const a = await pbkdf2({
      password: 'secret',
      salt: SALT,
      iterations: 1000,
      hash: 'SHA-256',
      encoding: 'hex',
    });
    const b = await pbkdf2({
      password: 'secret',
      salt: SALT,
      iterations: 1000,
      hash: 'SHA-256',
      encoding: 'hex',
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.value.hash).toBe(b.value.hash);
  });

  it('口令不同则结果不同', async () => {
    const a = await pbkdf2({
      password: 'a',
      salt: SALT,
      iterations: 1000,
      hash: 'SHA-256',
      encoding: 'hex',
    });
    const b = await pbkdf2({
      password: 'b',
      salt: SALT,
      iterations: 1000,
      hash: 'SHA-256',
      encoding: 'hex',
    });
    if (a.ok && b.ok) expect(a.value.hash).not.toBe(b.value.hash);
  });

  it('返回盐与通用格式串', async () => {
    const r = await pbkdf2({
      password: 'pw',
      salt: SALT,
      iterations: 2048,
      hash: 'SHA-512',
      encoding: 'hex',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.salt).toBe(SALT);
      expect(r.value.format.startsWith('pbkdf2$sha-512$2048$')).toBe(true);
    }
  });

  it('随机盐生成并通过格式校验', async () => {
    const r = await pbkdf2({ password: 'pw', iterations: 1000, hash: 'SHA-256', encoding: 'hex' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.salt).toMatch(/^[0-9a-f]{32}$/);
  });
});
