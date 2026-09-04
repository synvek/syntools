import type { ToolMeta } from '@/core/types';

export const imageIcoTool: ToolMeta = {
  id: 'image-ico',
  name: 'ICO 转换',
  description: '图片转多尺寸 ICO（favicon），或从 ICO 提取 PNG',
  category: 'image',
  keywords: ['ico', 'favicon', '图标', 'icon', 'png', '转换', 'convert'],
  icon: 'image-ico',
  component: () => import('./ImageIcoTool'),
  weight: 21,
};
