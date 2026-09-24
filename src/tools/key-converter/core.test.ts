import { describe, expect, it } from 'vitest';
import { generateRsaKeyPair } from '../rsa-crypto/core';
import { convertKey, type KeyTarget } from './core';

const TARGETS: KeyTarget[] = ['pem', 'der', 'jwk', 'openssh'];

describe('key-converter', () => {
  it('空输入报错', async () => {
    expect(await convertKey('', 'pem')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('PEM 公钥 → JWK 保留 RSA 类型', async () => {
    const kp = await generateRsaKeyPair(2048);
    expect(kp.ok).toBe(true);
    if (!kp.ok) return;
    const r = await convertKey(kp.value.publicKey, 'jwk');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.parse(r.value).kty).toBe('RSA');
  });

  it('PEM 公钥 → OpenSSH → 解析回 PEM 往返', async () => {
    const kp = await generateRsaKeyPair(2048);
    expect(kp.ok).toBe(true);
    if (!kp.ok) return;
    const ossh = await convertKey(kp.value.publicKey, 'openssh');
    expect(ossh.ok).toBe(true);
    if (!ossh.ok) return;
    expect(ossh.value.startsWith('ssh-rsa ')).toBe(true);
    const back = await convertKey(ossh.value, 'pem');
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.value).toContain('-----BEGIN PUBLIC KEY-----');
  });

  it('PEM 私钥 → DER 产出 base64', async () => {
    const kp = await generateRsaKeyPair(2048);
    expect(kp.ok).toBe(true);
    if (!kp.ok) return;
    const der = await convertKey(kp.value.privateKey, 'der');
    expect(der.ok).toBe(true);
    if (!der.ok) return;
    expect(der.value).not.toContain('-----');
  });

  it('OpenSSH 仅支持公钥', async () => {
    const kp = await generateRsaKeyPair(2048);
    expect(kp.ok).toBe(true);
    if (!kp.ok) return;
    const ossh = await convertKey(kp.value.privateKey, 'openssh');
    expect(ossh.ok).toBe(false);
    if (!ossh.ok) expect(ossh.error).toBe('NEED_PUBLIC');
  });

  it('JWK → PEM 恢复正确类型', async () => {
    const kp = await generateRsaKeyPair(2048);
    expect(kp.ok).toBe(true);
    if (!kp.ok) return;
    const jwk = await convertKey(kp.value.publicKey, 'jwk');
    expect(jwk.ok).toBe(true);
    if (!jwk.ok) return;
    const pem = await convertKey(jwk.value, 'pem');
    expect(pem.ok).toBe(true);
    if (!pem.ok) return;
    expect(pem.value).toContain('-----BEGIN PUBLIC KEY-----');
  });

  for (const target of TARGETS) {
    it(`PEM 私钥可转为 ${target}`, async () => {
      const kp = await generateRsaKeyPair(2048);
      expect(kp.ok).toBe(true);
      if (!kp.ok) return;
      const r = await convertKey(kp.value.privateKey, target);
      if (target === 'openssh') {
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toBe('NEED_PUBLIC');
      } else {
        expect(r.ok).toBe(true);
      }
    });
  }
});
