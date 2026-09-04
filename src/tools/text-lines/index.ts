import type { ToolMeta } from '@/core/types';

export const textLinesTool: ToolMeta = {
  id: 'text-lines',
  name: '文本行处理',
  description: '行排序 / 去重 / 反转 / 编号 / 去空行',
  category: 'text',
  keywords: ["lines","sort","unique","行","排序","去重"],
  icon: 'text',
  component: () => import('./TextLinesTool'),
  weight: 5,
};
