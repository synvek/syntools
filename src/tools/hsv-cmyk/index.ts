import type { ToolMeta } from '@/core/types';

export const hsvCmykTool: ToolMeta = {
  id: 'hsv-cmyk',
  name: 'HSV / CMYK 转换',
  description: 'RGB、HSV、CMYK、HEX 颜色空间互转与预览',
  category: 'other',
  keywords: ['hsv', 'cmyk', 'rgb', 'hex', '颜色', 'color', '转换'],
  icon: 'hsv-cmyk',
  component: () => import('./HsvCmykTool'),
  weight: 2,
};
