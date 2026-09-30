import { deflate } from 'pako';
import { afterEach, describe, expect, it } from 'vitest';
import { decodeCompressedShare, encodeCompressedShare } from './shareCode';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('分享状态压缩编解码', () => {
  afterEach(() => {
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('编码 → 解码往返一致，且参数带 z 前缀', () => {
    const state = { i: 'const a = 1;', l: 'javascript', th: 'vscode-dark', ind: '2' };
    const param = encodeCompressedShare(state);
    expect(param.startsWith('z')).toBe(true);
    expect(decodeCompressedShare(param)).toEqual(state);
  });

  it('压缩后明显短于未压缩 JSON', () => {
    const code = 'x'.repeat(2000);
    const param = encodeCompressedShare({ i: code, l: 'javascript' });
    expect(param.length).toBeLessThan(JSON.stringify({ i: code }).length);
  });

  it('非压缩前缀 / 非法输入返回 null 而不抛异常', () => {
    expect(decodeCompressedShare('abc')).toBeNull();
    expect(decodeCompressedShare('z')).toBeNull();
    expect(decodeCompressedShare('z###')).toBeNull();
  });

  it('解压结果不是普通对象（如数组）时返回 null', () => {
    const param = `z${toBase64Url(deflate('[1,2]'))}`;
    expect(decodeCompressedShare(param)).toBeNull();
  });

  it('解压结果含非原始类型值时返回 null', () => {
    const param = `z${toBase64Url(deflate('{"i":{"nested":true}}'))}`;
    expect(decodeCompressedShare(param)).toBeNull();
  });
});
