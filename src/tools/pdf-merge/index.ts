import type { ToolMeta } from '@/core/types';

export const pdfMergeTool: ToolMeta = {
  id: 'pdf-merge',
  name: 'PDF 合并',
  description: '将多个 PDF 合并为一个文件',
  category: 'pdf',
  keywords: ['pdf', 'merge', '合并'],
  icon: 'pdfMerge',
  component: () => import('./PdfMergeTool'),
  weight: 1,
  relatedIds: ['pdf-split', 'pdf-reorder', 'pdf-encrypt', 'pdf-to-image'],
};
