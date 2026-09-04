import type { ToolMeta } from '@/core/types';

export const pdfEncryptTool: ToolMeta = {
  id: 'pdf-encrypt',
  name: 'PDF 加密保护',
  description: '为 PDF 设置密码与权限',
  category: 'pdf',
  keywords: ["pdf","encrypt","加密","密码","权限"],
  icon: 'pdfEncrypt',
  component: () => import('./PdfEncryptTool'),
  weight: 16,
};
