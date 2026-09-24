import type { ToolMeta } from '@/core/types';

export const imageGridCutTool: ToolMeta = {
  id: 'image-grid-cut',
  name: '图片九宫格切图',
  description: '将图片按行列切分为多块（九宫格 / 拼图），逐块下载',
  category: 'image',
  keywords: ['grid', 'cut', '九宫格', '切图', '拼图', '分割', 'image', 'slice'],
  icon: 'grid',
  component: () => import('./ImageGridCutTool'),
  relatedIds: ['image-crop', 'image-merge'],
};
