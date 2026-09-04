import type { ToolMeta } from '@/core/types';

export const pdfToImageTool: ToolMeta = {
  id: 'pdf-to-image',
  name: 'PDF 转图片',
  description: '将 PDF 页面渲染为 JPG/PNG',
  category: 'pdf',
  keywords: ["pdf","image","转图片","jpg","png"],
  icon: 'pdfToImage',
  component: () => import('./PdfToImageTool'),
  weight: 7,
};
