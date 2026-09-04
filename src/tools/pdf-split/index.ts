import type { ToolMeta } from '@/core/types';

export const pdfSplitTool: ToolMeta = {
  id: 'pdf-split',
  name: 'PDF 拆分',
  description: '将 PDF 按页拆分为多个文件',
  category: 'pdf',
  keywords: ['pdf', 'split', '拆分'],
  icon: 'pdfSplit',
  component: () => import('./PdfSplitTool'),
  weight: 2,
  relatedIds: ['pdf-merge', 'pdf-extract-pages', 'pdf-delete-pages', 'images-to-pdf'],
};
