import type { ToolMeta } from '@/core/types';

export const randomNumberTool: ToolMeta = {
  id: 'random-number',
  name: '随机数生成器',
  description: '指定范围与数量生成随机整数或小数，支持去重',
  category: 'generator',
  keywords: ['random', 'number', '随机数', '生成', '整数', '小数'],
  icon: 'hash',
  component: () => import('./RandomNumberTool'),
  weight: 2,
};
