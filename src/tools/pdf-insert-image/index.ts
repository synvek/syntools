import type { ToolMeta } from '@/core/types';

export const pdfInsertImageTool: ToolMeta = {
  id: 'pdf-insert-image',
  name: 'PDF 插入图片',
  description: '在 PDF 页面上插入图片',
  category: 'pdf',
  keywords: ["pdf","图片","watermark","插入"],
  icon: 'pdfInsertImage',
  component: () => import('./PdfInsertImageTool'),
  weight: 12,
};
