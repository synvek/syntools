import type { ToolMeta } from '@/core/types';

export const uuidTool: ToolMeta = {
  id: 'uuid',
  name: 'UUID 生成器',
  description: 'v4 / v7 随机 UUID，批量生成与大小写、横线、花括号格式选项',
  category: 'generator',
  keywords: ['uuid', 'guid', '唯一标识', '随机', 'v4', 'v7'],
  icon: 'dice',
  component: () => import('./UuidTool'),
  weight: 1,
};
