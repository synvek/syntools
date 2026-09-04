import type { ToolMeta } from '@/core/types';

export const pdfReorderTool: ToolMeta = {
  id: 'pdf-reorder',
  name: 'PDF 页面排序',
  description: '拖拽或指定顺序重新排列页面',
  category: 'pdf',
  keywords: ['pdf', 'reorder', '排序'],
  icon: 'pdfReorder',
  component: () => import('./PdfReorderTool'),
  weight: 5,
  relatedIds: ['pdf-rotate', 'pdf-delete-pages', 'pdf-extract-pages', 'pdf-merge'],
};
