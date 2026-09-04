import type { ToolMeta } from '@/core/types';

export const sqlFormatTool: ToolMeta = {
  id: 'sql-format',
  name: 'SQL 格式化',
  description: '多方言 SQL 美化：缩进 / 关键字大小写可选',
  category: 'formatting',
  keywords: ['sql', '格式化', '美化', 'format', 'mysql', 'postgresql', 'query'],
  icon: 'database',
  component: () => import('./SqlFormatTool'),
  weight: 3,
};
