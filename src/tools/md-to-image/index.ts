import type { ToolMeta } from '@/core/types';

export const mdToImageTool: ToolMeta = {
  id: 'md-to-image',
  name: 'Markdown 转图片',
  description: '将 Markdown 渲染为卡片图并导出 PNG，可调字体、字号、宽度与颜色',
  category: 'text',
  keywords: ['markdown', 'md', '图片', 'png', 'export', '导出', '预览', '字体', '字号'],
  icon: 'md-to-image',
  component: () => import('./MdToImageTool'),
  weight: 24,
};
