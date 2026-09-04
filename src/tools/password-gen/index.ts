import type { ToolMeta } from '@/core/types';

export const passwordGenTool: ToolMeta = {
  id: 'password-gen',
  name: '随机密码生成器',
  description: '高强度随机密码：长度 / 字符集可选，熵估算与强度分级',
  category: 'generator',
  keywords: ['password', '密码', '随机', '生成', 'random', '强密码'],
  icon: 'dice',
  component: () => import('./PasswordGenTool'),
  weight: 1,
};
