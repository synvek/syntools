import type { ToolMeta } from '@/core/types';

export const pdfCompressTool: ToolMeta = {
  id: 'pdf-compress',
  name: 'PDF 压缩',
  description: '压缩 PDF：对象流无损压缩，或逐页重编码为 JPEG 的有损压缩',
  category: 'pdf',
  keywords: ['pdf', 'compress', 'shrink', '压缩', '减小体积', '优化'],
  icon: 'archive',
  component: () => import('./PdfCompressTool'),
  relatedIds: ['pdf-to-image', 'image-compress'],
};
