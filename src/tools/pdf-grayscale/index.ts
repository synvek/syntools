import type { ToolMeta } from '@/core/types';

export const pdfGrayscaleTool: ToolMeta = {
  id: 'pdf-grayscale',
  name: 'PDF 转灰度',
  description: '将 PDF 转为视觉灰度版',
  category: 'pdf',
  keywords: ["pdf","grayscale","灰度"],
  icon: 'pdfGrayscale',
  component: () => import('./PdfGrayscaleTool'),
  weight: 18,
};
