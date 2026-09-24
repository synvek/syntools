import { describe, expect, it } from 'vitest';
import { allChecksums, checksum, type ChecksumAlgo } from './core';

describe('checksum 已知测试向量', () => {
  // CRC-32 标准校验序列
  it('crc32("123456789") = CBF43926', () => {
    expect(checksum('crc32', new TextEncoder().encode('123456789'))).toEqual({
      ok: true,
      value: 'CBF43926',
    });
  });
  // Adler-32 标准校验序列
  it('adler32("123456789") = 091E01DE', () => {
    expect(checksum('adler32', new TextEncoder().encode('123456789'))).toEqual({
      ok: true,
      value: '091E01DE',
    });
  });
  it('fnv1a32("") = 811C9DC5', () => {
    expect(checksum('fnv1a32', new Uint8Array())).toEqual({ ok: true, value: '811C9DC5' });
  });
  it('fnv1a32("hello") = 4F9F2CAB', () => {
    expect(checksum('fnv1a32', new TextEncoder().encode('hello'))).toEqual({
      ok: true,
      value: '4F9F2CAB',
    });
  });
  it('fnv1a64("hello") = A430D84680AABD0B', () => {
    expect(checksum('fnv1a64', new TextEncoder().encode('hello'))).toEqual({
      ok: true,
      value: 'A430D84680AABD0B',
    });
  });
});

describe('checksum 一致性', () => {
  const algos: ChecksumAlgo[] = ['crc32', 'adler32', 'fnv1a32', 'fnv1a64'];
  for (const a of algos) {
    it(`${a} 同输入稳定输出`, () => {
      const data = new TextEncoder().encode('syntools 中文 123');
      expect(checksum(a, data)).toEqual(checksum(a, data));
    });
  }

  it('allChecksums 覆盖四种算法', () => {
    const r = allChecksums(new TextEncoder().encode('abc'));
    expect(Object.keys(r).sort()).toEqual(['adler32', 'crc32', 'fnv1a32', 'fnv1a64']);
    expect(r.crc32).toBe('352441C2');
  });
});
