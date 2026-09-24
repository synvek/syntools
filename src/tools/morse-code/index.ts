import type { ToolMeta } from '@/core/types';

export const morseCodeTool: ToolMeta = {
  id: 'morse-code',
  name: '摩斯电码',
  description: '文本与摩斯电码互转，支持字母、数字与空格分词',
  category: 'encoding',
  keywords: ['morse', '摩斯', '电码', '电报', 'cw', '翻译'],
  icon: 'text',
  component: () => import('./MorseCodeTool'),
  relatedIds: [],
};
