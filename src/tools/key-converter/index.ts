import type { ToolMeta } from '@/core/types';

export const keyConverterTool: ToolMeta = {
  id: 'key-converter',
  name: '密钥格式转换',
  description: 'RSA 密钥在 PEM / DER / JWK / OpenSSH 之间互转（基于 WebCrypto）',
  category: 'crypto',
  keywords: ['pem', 'der', 'jwk', 'openssh', 'key', '密钥', '转换', 'rsa'],
  icon: 'key',
  component: () => import('./KeyConverterTool'),
  relatedIds: ['rsa-crypto', 'x509-decode'],
};
