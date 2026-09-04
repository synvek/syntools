import type { ToolMeta } from '@/core/types';

export const pdfCropTool: ToolMeta = {
  id: 'pdf-crop',
  name: 'PDF 裁剪',
  description: '裁剪 PDF 页面边距',
  category: 'pdf',
  keywords: ["pdf","crop","裁剪","边距"],
  icon: 'pdfCrop',
  component: () => import('./PdfCropTool'),
  weight: 17,
};
