import type { ToolMeta } from '@/core/types';

export const randomStringTool: ToolMeta = {
  id: 'random-string',
  name: '随机字符串生成器',
  description: '按长度与字符集批量生成随机字符串（字母数字 / hex / 自定义）',
  category: 'generator',
  keywords: ['random', 'string', '随机字符串', 'hex', '生成', 'charset'],
  icon: 'text',
  component: () => import('./RandomStringTool'),
  weight: 3,
};
