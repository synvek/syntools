import type { ToolMeta } from '@/core/types';

export const mdMindmapTool: ToolMeta = {
  id: 'md-mindmap',
  name: 'Markdown 思维导图',
  description: 'Markdown 转思维导图，多主题、缩放，导出 PNG/SVG',
  category: 'text',
  keywords: ['mindmap', '思维导图', 'markdown', 'md', 'svg', 'png', '大纲', '主题'],
  icon: 'md-mindmap',
  component: () => import('./MdMindmapTool'),
  weight: 24,
};
