import type { ToolMeta } from '@/core/types';

export const imageColorPickerTool: ToolMeta = {
  id: 'image-color-picker',
  name: '图片取色器',
  description: '上传图片并点击像素取色，输出 HEX / RGB',
  category: 'image',
  keywords: ['image', 'color', 'picker', '取色', '图片', 'eyedropper', 'pixel'],
  icon: 'eyedropper',
  component: () => import('./ImageColorPickerTool'),
  weight: 10,
};
