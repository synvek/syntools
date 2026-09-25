import type { ToolMeta } from '@/core/types';

export const markdownPreviewTool: ToolMeta = {
  id: 'markdown-preview',
  name: 'Markdown 编辑器',
  description: '实时高亮编辑与预览、大纲导航、字数统计，支持打开/保存 .md 与导出 HTML',
  category: 'advanced',
  keywords: ['markdown', 'md', '编辑器', 'editor', '预览', 'preview', 'gfm', '大纲', '标记语言'],
  icon: 'markdown',
  component: () => import('./MarkdownEditorTool'),
  weight: 6,
  relatedIds: ['latex-editor', 'rich-text-editor', 'md-to-image'],
};
