import type { ToolResult } from '@/core/types';

export type ChecksumAlgo = 'crc32' | 'adler32' | 'fnv1a32' | 'fnv1a64';

export const CHECKSUM_ALGOS: { value: ChecksumAlgo; label: string }[] = [
  { value: 'crc32', label: 'CRC-32' },
  { value: 'adler32', label: 'Adler-32' },
  { value: 'fnv1a32', label: 'FNV-1a (32)' },
  { value: 'fnv1a64', label: 'FNV-1a (64)' },
];

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i += 1) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function fnv1a32(data: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i += 1) {
    hash ^= data[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function fnv1a64(data: Uint8Array): bigint {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < data.length; i += 1) {
    hash ^= BigInt(data[i]);
    hash = (hash * prime) % (1n << 64n);
  }
  return hash;
}

/** 计算校验和（十六进制，永不失败）。data 为空时返回 0（合法值）。 */
export function computeChecksum(algo: ChecksumAlgo, data: Uint8Array): string {
  let value: number | bigint;
  switch (algo) {
    case 'crc32':
      value = crc32(data);
      break;
    case 'adler32':
      value = adler32(data);
      break;
    case 'fnv1a32':
      value = fnv1a32(data);
      break;
    case 'fnv1a64':
      value = fnv1a64(data);
      break;
  }
  const hex =
    typeof value === 'bigint'
      ? value.toString(16).padStart(16, '0')
      : value.toString(16).padStart(8, '0');
  return hex.toUpperCase();
}

/** 计算校验和，返回统一的 ToolResult。 */
export function checksum(algo: ChecksumAlgo, data: Uint8Array): ToolResult<string> {
  return { ok: true, value: computeChecksum(algo, data) };
}

/** 一次性计算所有算法的校验和，便于对照。 */
export function allChecksums(data: Uint8Array): Record<ChecksumAlgo, string> {
  return {
    crc32: computeChecksum('crc32', data),
    adler32: computeChecksum('adler32', data),
    fnv1a32: computeChecksum('fnv1a32', data),
    fnv1a64: computeChecksum('fnv1a64', data),
  };
}
