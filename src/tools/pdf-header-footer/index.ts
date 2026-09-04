import type { ToolMeta } from '@/core/types';

export const pdfHeaderFooterTool: ToolMeta = {
  id: 'pdf-header-footer',
  name: 'PDF 页眉页脚',
  description: '为 PDF 添加页眉与页脚',
  category: 'pdf',
  keywords: ["pdf","页眉","页脚","header","footer"],
  icon: 'pdfHeaderFooter',
  component: () => import('./PdfHeaderFooterTool'),
  weight: 11,
};
