import type { ToolMeta } from '@/core/types';

export const barcodeTool: ToolMeta = {
  id: 'barcode',
  name: '条形码生成',
  description: '生成 Code 39 / Code 128 / EAN-13 条形码（SVG，纯前端）',
  category: 'generator',
  keywords: ['barcode', '条形码', '条码', 'code39', 'code128', 'ean13', '生成'],
  icon: 'barcode',
  component: () => import('./BarcodeTool'),
  relatedIds: ['qrcode'],
};
