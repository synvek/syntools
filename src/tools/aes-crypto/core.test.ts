import { describe, expect, it } from 'vitest';
import { decryptAes, encryptAes } from './core';

describe('aes-crypto', () => {
  it('空明文返回 EMPTY', async () => {
    expect(await encryptAes({ plaintext: '', mode: 'passphrase', passphrase: 'x' })).toEqual({
      ok: false,
      error: 'EMPTY',
    });
  });

  it('口令加密后可解密', async () => {
    const enc = await encryptAes({ plaintext: 'hello 世界', mode: 'passphrase', passphrase: 'secret' });
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const dec = await decryptAes({ ciphertext: enc.value, mode: 'passphrase', passphrase: 'secret' });
    expect(dec).toEqual({ ok: true, value: 'hello 世界' });
  });

  it('原始 key hex 加密解密', async () => {
    const keyHex = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
    const enc = await encryptAes({ plaintext: 'raw-key', mode: 'raw', keyHex });
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const dec = await decryptAes({ ciphertext: enc.value, mode: 'raw', keyHex });
    expect(dec).toEqual({ ok: true, value: 'raw-key' });
  });

  it('错误口令解密失败', async () => {
    const enc = await encryptAes({ plaintext: 'x', mode: 'passphrase', passphrase: 'a' });
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const dec = await decryptAes({ ciphertext: enc.value, mode: 'passphrase', passphrase: 'b' });
    expect(dec).toEqual({ ok: false, error: 'DECRYPT_FAILED' });
  });

  it('非法 key / 密文', async () => {
    expect(await encryptAes({ plaintext: 'x', mode: 'raw', keyHex: 'zz' })).toEqual({
      ok: false,
      error: 'INVALID_KEY',
    });
    expect(await decryptAes({ ciphertext: '!!!', mode: 'passphrase', passphrase: 'a' })).toEqual({
      ok: false,
      error: 'INVALID_INPUT',
    });
  });
});
