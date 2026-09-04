import type { ToolMeta } from '@/core/types';

export const imageToPaperTool: ToolMeta = {
  id: 'image-to-paper',
  name: '图片转纸张 PDF',
  description: '将图片按 A3/A4/A5/Letter 纸张适配并导出 PDF',
  category: 'image',
  keywords: ['pdf', '纸张', 'paper', 'a4', 'image', '图片', '导出', 'jspdf'],
  icon: 'image-to-paper',
  component: () => import('./ImageToPaperTool'),
  weight: 22,
};
