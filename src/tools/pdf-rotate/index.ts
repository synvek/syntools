import type { ToolMeta } from '@/core/types';

export const pdfRotateTool: ToolMeta = {
  id: 'pdf-rotate',
  name: 'PDF 旋转页面',
  description: '旋转 PDF 指定或全部页面',
  category: 'pdf',
  keywords: ["pdf","rotate","旋转"],
  icon: 'pdfRotate',
  component: () => import('./PdfRotateTool'),
  weight: 6,
};
