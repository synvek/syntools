import type { ToolMeta } from '@/core/types';

export const pdfMetadataTool: ToolMeta = {
  id: 'pdf-metadata',
  name: 'PDF 元数据',
  description: '查看与编辑 PDF 元数据',
  category: 'pdf',
  keywords: ["pdf","metadata","元数据","标题"],
  icon: 'pdfMetadata',
  component: () => import('./PdfMetadataTool'),
  weight: 15,
};
