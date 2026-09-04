import type { ToolMeta } from '@/core/types';

export const hmacTool: ToolMeta = {
  id: 'hmac',
  name: 'HMAC',
  description: 'HMAC-SHA256 / SHA512，hex / base64 输出',
  category: 'crypto',
  keywords: ["hmac","sha256","sha512","mac","签名"],
  icon: 'hash',
  component: () => import('./HmacTool'),
  weight: 4,
};
