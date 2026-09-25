import type { ToolMeta } from '@/core/types';

export const pdfExtractTextTool: ToolMeta = {
  id: 'pdf-extract-text',
  name: 'PDF 提取文本',
  description: '从 PDF 中提取全部页面的可复制文本（本地运行，支持加密文件）',
  category: 'pdf',
  keywords: ['pdf', 'text', 'extract', '提取', '文本', 'ocr', '内容'],
  icon: 'text',
  component: () => import('./PdfExtractTextTool'),
  relatedIds: ['pdf-viewer', 'pdf-decrypt'],
};
