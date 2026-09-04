import type { ToolMeta } from '@/core/types';

export const colorConverterTool: ToolMeta = {
  id: 'color-converter',
  name: '颜色转换',
  description: 'HEX / RGB / HSL 颜色格式互转与预览',
  category: 'other',
  keywords: ['颜色', 'color', 'hex', 'rgb', 'hsl', '转换', 'convert', '取色'],
  icon: 'palette',
  component: () => import('./ColorConverterTool'),
  weight: 1,
};
