import type { ToolMeta } from '@/core/types';

export const x509DecodeTool: ToolMeta = {
  id: 'x509-decode',
  name: 'X.509 证书解析',
  description: '解析 PEM：指纹 SHA-256/SHA-1、类型、DER 长度与 CN',
  category: 'crypto',
  keywords: ["x509","certificate","pem","证书","fingerprint","ssl","tls"],
  icon: 'key',
  component: () => import('./X509DecodeTool'),
  weight: 6,
};
