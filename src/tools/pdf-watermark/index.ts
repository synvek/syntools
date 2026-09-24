import type { ToolMeta } from '@/core/types';

export const pdfWatermarkTool: ToolMeta = {
  id: 'pdf-watermark',
  name: 'PDF 水印',
  description: '为 PDF 添加文字水印，支持平铺、旋转、透明度与页面范围（本地运行）',
  category: 'pdf',
  keywords: ['pdf', 'watermark', '水印', '文字', '印章', '标记'],
  icon: 'watermark',
  component: () => import('./PdfWatermarkTool'),
  relatedIds: ['image-watermark', 'pdf-merge'],
};
