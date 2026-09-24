import type { ToolMeta } from '@/core/types';

export const checksumTool: ToolMeta = {
  id: 'checksum',
  name: '校验和',
  description: 'CRC-32 / Adler-32 / FNV-1a 校验和计算（纯前端，零依赖）',
  category: 'crypto',
  keywords: ['checksum', 'crc32', 'adler32', 'fnv', '校验和', 'crc', '校验'],
  icon: 'fingerprint',
  component: () => import('./ChecksumTool'),
  relatedIds: ['hash', 'password-hash'],
};
