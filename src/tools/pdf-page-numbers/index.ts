import type { ToolMeta } from '@/core/types';

export const pdfPageNumbersTool: ToolMeta = {
  id: 'pdf-page-numbers',
  name: 'PDF 添加页码',
  description: '为 PDF 添加页码',
  category: 'pdf',
  keywords: ["pdf","页码","page number"],
  icon: 'pdfPageNumbers',
  component: () => import('./PdfPageNumbersTool'),
  weight: 10,
};
