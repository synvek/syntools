import { describe, expect, it } from 'vitest';
import { bytesToBase64, bytesToHex, hashFile, hashText } from './core';

describe('hashText（标准向量对齐）', () => {
  it('MD5 空串', async () => {
    const r = await hashText('md5', '', 'hex');
    expect(r).toEqual({ ok: true, value: 'd41d8cd98f00b204e9800998ecf8427e' });
  });

  it('MD5 abc', async () => {
    const r = await hashText('md5', 'abc', 'hex');
    expect(r).toEqual({ ok: true, value: '900150983cd24fb0d6963f7d28e17f72' });
  });

  it('SHA-1 abc', async () => {
    const r = await hashText('sha-1', 'abc', 'hex');
    expect(r).toEqual({ ok: true, value: 'a9993e364706816aba3e25717850c26c9cd0d89d' });
  });

  it('SHA-256 abc', async () => {
    const r = await hashText('sha-256', 'abc', 'hex');
    expect(r).toEqual({
      ok: true,
      value: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    });
  });

  it('SHA-512 abc', async () => {
    const r = await hashText('sha-512', 'abc', 'hex');
    expect(r).toEqual({
      ok: true,
      value:
        'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a' +
        '2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    });
  });

  it('SHA-256 空串的 base64 编码', async () => {
    const r = await hashText('sha-256', '', 'base64');
    expect(r).toEqual({ ok: true, value: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=' });
  });

  it('中文文本（Unicode 安全）', async () => {
    const r = await hashText('md5', '你好', 'hex');
    expect(r).toEqual({ ok: true, value: '7eca689f0d3389d9dea66ae112e5cfd7' });
  });
});

describe('hashFile', () => {
  it('SHA-256 文件与文本一致', async () => {
    const file = new File(['abc'], 'a.txt', { type: 'text/plain' });
    const r = await hashFile('sha-256', file, 'hex');
    expect(r).toEqual({
      ok: true,
      value: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    });
  });

  it('MD5 流式分块结果正确', async () => {
    const file = new File(['abc'], 'a.txt', { type: 'text/plain' });
    const r = await hashFile('md5', file, 'hex');
    expect(r).toEqual({ ok: true, value: '900150983cd24fb0d6963f7d28e17f72' });
  });
});

describe('编码工具函数', () => {
  it('bytesToHex', () => {
    expect(bytesToHex(new Uint8Array([0, 1, 255]))).toBe('0001ff');
  });

  it('bytesToBase64', () => {
    expect(bytesToBase64(new Uint8Array([104, 105]))).toBe(btoa('hi'));
  });
});
