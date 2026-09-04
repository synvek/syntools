import type { ToolMeta } from '@/core/types';

export const imageMergeTool: ToolMeta = {
  id: 'image-merge',
  name: '在线图片合并',
  description: '将多张图片横向 / 纵向 / 网格拼接为一张 PNG',
  category: 'image',
  keywords: ['merge', '拼接', '图片合并', 'collage', 'stitch', 'grid'],
  icon: 'imageMerge',
  component: () => import('./ImageMergeTool'),
  weight: 12,
};
