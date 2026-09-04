import type { ToolMeta } from '@/core/types';

export const imageAdjustTool: ToolMeta = {
  id: 'image-adjust',
  name: '在线图片调色',
  description: '调整图片亮度、对比度、饱和度与色相并导出 PNG',
  category: 'image',
  keywords: ['adjust', 'brightness', 'contrast', '调色', '亮度', '对比度', '饱和度'],
  icon: 'imageAdjust',
  component: () => import('./ImageAdjustTool'),
  weight: 18,
};
