import type { ToolMeta } from '@/core/types';

export const codeImageTool: ToolMeta = {
  id: 'code-image',
  name: '代码生成图片',
  description: '将代码渲染为带语法高亮的卡片图片并导出 PNG',
  category: 'image',
  keywords: ['code', 'image', 'screenshot', '代码', '图片', '高亮', 'carbon', 'png'],
  icon: 'codeImage',
  component: () => import('./CodeImageTool'),
  weight: 5,
};
