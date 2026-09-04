import type { ToolMeta } from '@/core/types';

export const pdfAnnotateTool: ToolMeta = {
  id: 'pdf-annotate',
  name: 'PDF 标注',
  description: '在页面上可视化绘制高亮、画笔、形状与文本',
  category: 'pdf',
  keywords: ['pdf', 'annotate', '高亮', '标注', '画笔', '椭圆', '文本'],
  icon: 'pdfAnnotate',
  component: () => import('./PdfAnnotateTool'),
  weight: 19,
};
