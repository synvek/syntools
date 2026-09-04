import type { ToolMeta } from '@/core/types';

export const hashTool: ToolMeta = {
  id: 'hash',
  name: '哈希计算',
  description: 'MD5 / SHA-1 / SHA-256 / SHA-512，支持文本与文件（流式），hex / base64 输出',
  category: 'crypto',
  keywords: ['hash', '哈希', 'md5', 'sha', 'sha256', '摘要', '校验和'],
  icon: 'hash',
  component: () => import('./HashTool'),
  weight: 1,
  relatedIds: ['aes-crypto', 'hmac', 'jwt-parser'],
};
