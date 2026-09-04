import type { ToolMeta } from '@/core/types';

export const pdfAddTextTool: ToolMeta = {
  id: 'pdf-add-text',
  name: 'PDF 添加文本',
  description: '在 PDF 页面上添加文本',
  category: 'pdf',
  keywords: ["pdf","text","文本","注释"],
  icon: 'pdfAddText',
  component: () => import('./PdfAddTextTool'),
  weight: 13,
};
