import type { ToolMeta } from '@/core/types';

export const pdfDecryptTool: ToolMeta = {
  id: 'pdf-decrypt',
  name: 'PDF 移除密码',
  description: '用密码加载后导出无保护 PDF（等效 qpdf --decrypt，纯本地）',
  category: 'pdf',
  keywords: ['pdf', 'decrypt', 'unlock', 'password', '解密', '移除密码'],
  icon: 'unlock',
  component: () => import('./PdfDecryptTool'),
  relatedIds: ['pdf-encrypt', 'pdf-extract-text'],
};
