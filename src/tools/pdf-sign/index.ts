import type { ToolMeta } from '@/core/types';

export const pdfSignTool: ToolMeta = {
  id: 'pdf-sign',
  name: 'PDF 签名',
  description: '手写或上传签名图（外观签名）',
  category: 'pdf',
  keywords: ["pdf","签名","sign","signature"],
  icon: 'pdfSign',
  component: () => import('./PdfSignTool'),
  weight: 14,
};
