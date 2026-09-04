import type { ToolMeta } from '@/core/types';

export const qrcodeTool: ToolMeta = {
  id: 'qrcode',
  name: '二维码',
  description: '文本生成二维码 / 图片识别二维码，支持纠错、尺寸、颜色与边距',
  category: 'encoding',
  keywords: ['二维码', 'qr', 'qrcode', '扫码', '识别', '生成', 'generate', 'scan', 'decode'],
  icon: 'qr',
  component: () => import('./QrCodeTool'),
  weight: 8,
};
