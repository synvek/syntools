import type { ToolMeta } from '@/core/types';

export const passwordHashTool: ToolMeta = {
  id: 'password-hash',
  name: '口令哈希 (PBKDF2)',
  description: '基于 WebCrypto 的 PBKDF2 口令派生哈希，支持自定义盐与迭代次数',
  category: 'crypto',
  keywords: ['pbkdf2', 'password', 'hash', '口令', '哈希', '盐', '派生'],
  icon: 'hash',
  component: () => import('./PasswordHashTool'),
  relatedIds: ['password-strength', 'checksum'],
};
