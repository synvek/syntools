import type { ToolMeta } from '@/core/types';

export const rsaCryptoTool: ToolMeta = {
  id: 'rsa-crypto',
  name: 'RSA 加解密',
  description: 'RSA-OAEP 加解密、RSA-PSS 签名验签与密钥对生成（基于 WebCrypto）',
  category: 'crypto',
  keywords: ['rsa', 'encrypt', 'decrypt', 'sign', 'verify', '加密', '解密', '签名', '密钥'],
  icon: 'lock',
  component: () => import('./RsaCryptoTool'),
  relatedIds: ['key-converter', 'aes-crypto', 'password-hash'],
};
