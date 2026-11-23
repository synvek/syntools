import type { ToolMeta } from '@/core/types';

export const imagesToPdfTool: ToolMeta = {
  id: 'images-to-pdf',
  name: '图片转 PDF',
  description: '将多张图片合成为 PDF',
  category: 'pdf',
  keywords: ['pdf', 'image', '图片转pdf'],
  icon: 'imagesToPdf',
  component: () => import('./ImagesToPdfTool'),
  weight: 8,
  // The generated PDF usually needs a caption or a page order fix right after — point at the editor
  relatedIds: ['pdf-editor', 'pdf-to-image', 'pdf-merge'],
};
