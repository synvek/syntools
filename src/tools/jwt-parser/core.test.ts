import { describe, expect, it } from 'vitest';
import {
  encodeJwtUnsigned,
  isExpired,
  normalizeToken,
  parseJwt,
  readTimeClaim,
  signJwtHs256,
} from './core';

/** jwt.io 官方示例 token（HS256） */
const VALID_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ' +
  '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

/** 测试辅助：任意对象 → base64url 段（UTF-8 字节，支持非 ASCII） */
const enc = (obj: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

describe('parseJwt', () => {
  it('解析标准 token：header/payload/签名/alg 均正确', () => {
    const result = parseJwt(VALID_TOKEN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(result.value.payload).toEqual({
      sub: '1234567890',
      name: 'John Doe',
      iat: 1516239022,
    });
    expect(result.value.signature).toBe('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
    expect(result.value.alg).toBe('HS256');
  });

  it('支持 Bearer 前缀与首尾空白', () => {
    const result = parseJwt(`  Bearer ${VALID_TOKEN}\n`);
    expect(result.ok).toBe(true);
  });

  it('支持无填充的 base64url 段与 Unicode payload', () => {
    const token = `${enc({ alg: 'none' })}.${enc({ name: '张三' })}.`;
    const result = parseJwt(token);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.payload.name).toBe('张三');
    expect(result.value.alg).toBe('none');
    expect(result.value.signature).toBe('');
  });

  it('header 无 alg 声明时返回 null', () => {
    const result = parseJwt(`${enc({ typ: 'JWT' })}.${enc({ a: 1 })}.sig`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.alg).toBeNull();
  });

  it('空输入返回 EMPTY', () => {
    expect(parseJwt('')).toEqual({ ok: false, error: 'EMPTY' });
    expect(parseJwt('  ')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('段数不为 3 返回 INVALID_PARTS', () => {
    expect(parseJwt('abc.def')).toEqual({ ok: false, error: 'INVALID_PARTS' });
    expect(parseJwt('a.b.c.d')).toEqual({ ok: false, error: 'INVALID_PARTS' });
  });

  it('header 非法（非 JSON/非对象）返回 INVALID_HEADER', () => {
    expect(parseJwt('not-base64.eyJhIjoxfQ.sig')).toEqual({
      ok: false,
      error: 'INVALID_HEADER',
    });
    expect(parseJwt(`${enc([1, 2])}.${enc({ a: 1 })}.sig`)).toEqual({
      ok: false,
      error: 'INVALID_HEADER',
    });
  });

  it('payload 非法返回 INVALID_PAYLOAD', () => {
    expect(parseJwt(`${enc({ alg: 'HS256' })}.!!invalid.sig`)).toEqual({
      ok: false,
      error: 'INVALID_PAYLOAD',
    });
  });
});

describe('normalizeToken', () => {
  it('去空白与 Bearer 前缀', () => {
    expect(normalizeToken('  abc  ')).toBe('abc');
    expect(normalizeToken('Bearer abc')).toBe('abc');
    expect(normalizeToken('abc')).toBe('abc');
  });
});

describe('时间声明', () => {
  it('readTimeClaim：合法数值返回，缺失/非数值返回 null', () => {
    expect(readTimeClaim({ exp: 1700000000 }, 'exp')).toBe(1700000000);
    expect(readTimeClaim({ exp: '1700000000' }, 'exp')).toBeNull();
    expect(readTimeClaim({ exp: Infinity }, 'exp')).toBeNull();
    expect(readTimeClaim({}, 'iat')).toBeNull();
  });

  it('isExpired：过期/未过期/无 exp', () => {
    const now = 1700000000 * 1000;
    expect(isExpired({ exp: 1699999999 }, now)).toBe(true);
    expect(isExpired({ exp: 1700000001 }, now)).toBe(false);
    expect(isExpired({}, now)).toBeNull();
  });
});

describe('signJwtHs256', () => {
  it('签发后可解析且 alg 为 HS256', async () => {
    const r = await signJwtHs256('{"sub":"1","name":"Ada"}', 'secret');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const parsed = parseJwt(r.value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.alg).toBe('HS256');
    expect(parsed.value.payload).toEqual({ sub: '1', name: 'Ada' });
  });

  it('空 payload / 空密钥 EMPTY', async () => {
    expect(await signJwtHs256('', 's')).toEqual({ ok: false, error: 'EMPTY' });
    expect(await signJwtHs256('{}', '')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('非法 JSON INVALID_PAYLOAD', async () => {
    expect(await signJwtHs256('{', 's')).toEqual({ ok: false, error: 'INVALID_PAYLOAD' });
  });

  it('与 jwt.io 示例密钥签发匹配已知签名', async () => {
    const r = await signJwtHs256(
      '{"sub":"1234567890","name":"John Doe","iat":1516239022}',
      'your-256-bit-secret',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBe(VALID_TOKEN);
  });
});

describe('encodeJwtUnsigned', () => {
  it('无签名编码', () => {
    const r = encodeJwtUnsigned('{"a":1}');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.endsWith('.')).toBe(true);
    const parsed = parseJwt(r.value);
    expect(parsed.ok).toBe(true);
  });
});
