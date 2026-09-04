import type { ToolMeta } from '@/core/types';

export const textCounterTool: ToolMeta = {
  id: 'text-counter',
  name: '字数统计',
  description: '统计字符、单词、行数、段落、CJK 与 UTF-8 字节',
  category: 'text',
  keywords: ['word', 'count', '字数', '字符', '统计', 'counter', 'bytes', '行数'],
  icon: 'counter',
  component: () => import('./TextCounterTool'),
  weight: 4,
};
