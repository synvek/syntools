import type { ToolMeta } from '@/core/types';

export const pdfViewerTool: ToolMeta = {
  id: 'pdf-viewer',
  name: 'PDF 在线阅读',
  description: '本地打开并阅读 PDF',
  category: 'pdf',
  keywords: ["pdf","viewer","阅读","预览"],
  icon: 'pdfViewer',
  component: () => import('./PdfViewerTool'),
  weight: 9,
};
