import type { ToolMeta } from '@/core/types';

export const pdfExtractPagesTool: ToolMeta = {
  id: 'pdf-extract-pages',
  name: 'PDF 提取页面',
  description: '从 PDF 中提取指定页面',
  category: 'pdf',
  keywords: ["pdf","extract","提取"],
  icon: 'pdfExtract',
  component: () => import('./PdfExtractPagesTool'),
  weight: 4,
};
