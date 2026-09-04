import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64, decodeBase64, encodeBase64 } from './core';

describe('encodeBase64', () => {
  it('ASCII 文本编码', () => {
    expect(encodeBase64('hello')).toEqual({ ok: true, value: 'aGVsbG8=' });
  });

  it('中文与 emoji 编码（Unicode 安全）', () => {
    const r = encodeBase64('你好🌍');
    expect(r.ok).toBe(true);
    if (r.ok) expect(decodeBase64(r.value)).toEqual({ ok: true, value: '你好🌍' });
  });

  it('空串编码为空', () => {
    expect(encodeBase64('')).toEqual({ ok: true, value: '' });
  });

  it('URL Safe 变体替换 + / 并去除填充', () => {
    const standard = encodeBase64('?>>');
    const safe = encodeBase64('?>>', true);
    expect(standard).toEqual({ ok: true, value: 'Pz4+' });
    expect(safe).toEqual({ ok: true, value: 'Pz4-' });
  });
});

describe('decodeBase64', () => {
  it('正常解码', () => {
    expect(decodeBase64('aGVsbG8=')).toEqual({ ok: true, value: 'hello' });
  });

  it('忽略空白字符', () => {
    expect(decodeBase64('aGVs\nbG8= ')).toEqual({ ok: true, value: 'hello' });
  });

  it('URL Safe 输入可直接解码', () => {
    expect(decodeBase64('Pz4-', true)).toEqual({ ok: true, value: '?>>' });
  });

  it('非法字符报错并给出位置', () => {
    const r = decodeBase64('aG$s');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe('INVALID_CHAR');
      expect(r.params?.position).toBe(2);
    }
  });

  it('中间出现填充符报错', () => {
    const r = decodeBase64('aG=sbG8=');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('INVALID_PADDING');
  });

  it('长度余 1 报错', () => {
    const r = decodeBase64('aaaaa');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('INVALID_LENGTH');
  });
});

describe('bytesToBase64 / base64ToBytes', () => {
  it('字节数组往返一致', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const encoded = bytesToBase64(bytes);
    const decoded = base64ToBytes(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect([...decoded.value]).toEqual([...bytes]);
  });
});
