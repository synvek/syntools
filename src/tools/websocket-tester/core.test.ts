import { describe, expect, it } from 'vitest';
import { closeCodeText, decodePayload, encodePayload, nextLogId, validateWsUrl } from './core';

describe('validateWsUrl', () => {
  it('接受 ws 与 wss', () => {
    expect(validateWsUrl('ws://localhost:8080')).toEqual({
      ok: true,
      value: { url: 'ws://localhost:8080/', secure: false },
    });
    expect(validateWsUrl('wss://echo.example.com').ok).toBe(true);
  });

  it('拒绝其他协议与非法地址', () => {
    expect(validateWsUrl('')).toEqual({ ok: false, error: 'EMPTY' });
    expect(validateWsUrl('https://example.com').ok).toBe(false);
    expect(validateWsUrl('not a url').ok).toBe(false);
  });
});

describe('encodePayload', () => {
  it('text 模式直接返回字符串', () => {
    expect(encodePayload('hello', 'text')).toEqual({ ok: true, value: 'hello' });
    expect(encodePayload('', 'text')).toEqual({ ok: false, error: 'EMPTY_MESSAGE' });
  });

  it('hex 模式转换为字节', () => {
    const result = encodePayload('48 65 6c 6c 6f', 'hex');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.from(result.value as Uint8Array)).toEqual([72, 101, 108, 108, 111]);
  });

  it('拒绝非法 hex 与 base64', () => {
    expect(encodePayload('abc', 'hex')).toEqual({ ok: false, error: 'INVALID_HEX' });
    expect(encodePayload('zzz', 'hex')).toEqual({ ok: false, error: 'INVALID_HEX' });
    expect(encodePayload('!!!', 'base64')).toEqual({ ok: false, error: 'INVALID_BASE64' });
  });
});

describe('decodePayload', () => {
  it('字符串按 hex 模式转十六进制', () => {
    expect(decodePayload('AB', 'hex')).toBe('41 42');
  });

  it('ArrayBuffer 解码为文本', () => {
    const bytes = new TextEncoder().encode('hi').buffer;
    expect(decodePayload(bytes, 'text')).toBe('hi');
  });

  it('未知类型回退为字符串', () => {
    expect(decodePayload(42, 'text')).toBe('42');
  });
});

describe('日志与关闭码', () => {
  it('nextLogId 单调递增', () => {
    const a = nextLogId();
    expect(nextLogId()).toBe(a + 1);
  });

  it('映射标准关闭码', () => {
    expect(closeCodeText(1000)).toBe('CLOSE_NORMAL');
    expect(closeCodeText(1006)).toBe('CLOSE_ABNORMAL');
    expect(closeCodeText(4001)).toBe('CLOSE_UNKNOWN');
  });
});
