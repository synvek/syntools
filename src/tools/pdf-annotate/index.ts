import type { ToolMeta } from '@/core/types';

export const pdfAnnotateTool: ToolMeta = {
  id: 'pdf-annotate',
  name: 'PDF 标注',
  description: '高亮、画线或矩形标注',
  category: 'pdf',
  keywords: ["pdf","annotate","高亮","标注"],
  icon: 'pdfAnnotate',
  component: () => import('./PdfAnnotateTool'),
  weight: 19,
};
