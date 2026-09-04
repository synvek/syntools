import type { ToolMeta } from '@/core/types';

export const markdownPreviewTool: ToolMeta = {
  id: 'markdown-preview',
  name: 'Markdown 预览',
  description: 'GFM 实时渲染，输出经 DOMPurify 消毒，安全预览',
  category: 'text',
  keywords: ['markdown', 'md', '预览', 'preview', '渲染', 'gfm', '标记语言'],
  icon: 'markdown',
  component: () => import('./MarkdownPreviewTool'),
  weight: 5,
};
