import type { ToolMeta } from '@/core/types';

export const codeHighlightTool: ToolMeta = {
  id: 'code-highlight',
  name: '代码在线高亮',
  description: '多语言语法高亮预览，支持行号与复制 HTML 片段',
  category: 'formatting',
  keywords: ['highlight', 'syntax', 'prism', '高亮', '代码', '语法', '着色'],
  icon: 'codeHighlight',
  component: () => import('./CodeHighlightTool'),
  weight: 14,
};
