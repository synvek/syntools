import type { ToolMeta } from '@/core/types';

export const passwordStrengthTool: ToolMeta = {
  id: 'password-strength',
  name: '密码强度检测',
  description: '本地估算密码强度：熵值、字符集覆盖与常见弱模式提示',
  category: 'crypto',
  keywords: ['password', 'strength', '密码', '强度', 'entropy', '熵'],
  icon: 'shield',
  component: () => import('./PasswordStrengthTool'),
  relatedIds: ['password-gen', 'password-hash'],
};
