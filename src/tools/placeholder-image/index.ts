import type { ToolMeta } from '@/core/types';

export const placeholderImageTool: ToolMeta = {
  id: 'placeholder-image',
  name: '在线占位图生成',
  description: '按尺寸与颜色生成占位 PNG，可自定义文字',
  category: 'image',
  keywords: ['placeholder', '占位图', 'dummy', 'image', 'png', 'mock'],
  icon: 'placeholder',
  component: () => import('./PlaceholderImageTool'),
  weight: 14,
};
