import type { ToolMeta } from '@/core/types';

export const pdfDeletePagesTool: ToolMeta = {
  id: 'pdf-delete-pages',
  name: 'PDF 删除页面',
  description: '删除 PDF 中的指定页面',
  category: 'pdf',
  keywords: ["pdf","delete","删除","页面"],
  icon: 'pdfDelete',
  component: () => import('./PdfDeletePagesTool'),
  weight: 3,
};
