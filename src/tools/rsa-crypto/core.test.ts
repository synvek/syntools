import { describe, expect, it } from 'vitest';
import {
  generateRsaKeyPair,
  rsaDecrypt,
  rsaEncrypt,
  rsaSign,
  rsaVerify,
  type RsaKeyBits,
} from './core';

describe('rsa-crypto', () => {
  it('生成密钥对并输出 PEM', async () => {
    const r = await generateRsaKeyPair(2048);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    expect(r.value.privateKey).toContain('-----BEGIN PRIVATE KEY-----');
  });

  it('公钥加密 / 私钥解密', async () => {
    const kp = await generateRsaKeyPair(2048);
    expect(kp.ok).toBe(true);
    if (!kp.ok) return;
    const enc = await rsaEncrypt(kp.value.publicKey, 'hello 世界 🔐');
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const dec = await rsaDecrypt(kp.value.privateKey, enc.value);
    expect(dec).toEqual({ ok: true, value: 'hello 世界 🔐' });
  });

  it('私钥签名 / 公钥验签', async () => {
    const kp = await generateRsaKeyPair(2048);
    expect(kp.ok).toBe(true);
    if (!kp.ok) return;
    const sig = await rsaSign(kp.value.privateKey, 'message');
    expect(sig.ok).toBe(true);
    if (!sig.ok) return;
    const ok = await rsaVerify(kp.value.publicKey, 'message', sig.value);
    expect(ok).toEqual({ ok: true, value: true });
    const bad = await rsaVerify(kp.value.publicKey, 'tampered', sig.value);
    expect(bad).toEqual({ ok: true, value: false });
  });

  it('错误私钥解密失败', async () => {
    const a = await generateRsaKeyPair(2048);
    const b = await generateRsaKeyPair(2048);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    const enc = await rsaEncrypt(a.value.publicKey, 'secret');
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const dec = await rsaDecrypt(b.value.privateKey, enc.value);
    expect(dec.ok).toBe(false);
    if (dec.ok) return;
    expect(dec.error).toBe('DECRYPT_FAILED');
  });

  it('非法密钥报错', async () => {
    expect(await rsaEncrypt('not-a-key', 'x')).toEqual({ ok: false, error: 'INVALID_KEY' });
    expect(await rsaSign('not-a-key', 'x')).toEqual({ ok: false, error: 'INVALID_KEY' });
  });

  it('空输入报错', async () => {
    const kp = await generateRsaKeyPair(2048);
    expect(kp.ok).toBe(true);
    if (!kp.ok) return;
    expect(await rsaEncrypt(kp.value.publicKey, '')).toEqual({ ok: false, error: 'EMPTY' });
    expect(await rsaDecrypt(kp.value.privateKey, '')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('支持 4096 位', async () => {
    const r = await generateRsaKeyPair(4096 as RsaKeyBits);
    expect(r.ok).toBe(true);
  });
});
