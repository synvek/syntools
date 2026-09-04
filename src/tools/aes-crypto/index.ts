import type { ToolMeta } from '@/core/types';

export const aesCryptoTool: ToolMeta = {
  id: 'aes-crypto',
  name: 'AES 加解密',
  description: 'AES-GCM 加解密：口令 PBKDF2 或原始密钥，输出 base64(salt|iv|密文)',
  category: 'crypto',
  keywords: ["aes","gcm","encrypt","decrypt","加密","解密","pbkdf2"],
  icon: 'key',
  component: () => import('./AesCryptoTool'),
  weight: 3,
};
