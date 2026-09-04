import type { ToolMeta } from '@/core/types';

export const textDiffTool: ToolMeta = {
  id: 'text-diff',
  name: '文本对比',
  description: '左右编辑器内行级 Diff 高亮与行号，支持忽略空白',
  category: 'text',
  keywords: ['diff', '对比', '比较', '差异', 'compare', '文本比较'],
  icon: 'diff',
  component: () => import('./TextDiffTool'),
  weight: 2,
};
