import type { ToolMeta } from '@/core/types';

export const imageFrameTool: ToolMeta = {
  id: 'image-frame',
  name: '图片边框 / 圆角 / 阴影',
  description: '为图片添加边框、圆角与阴影效果并导出 PNG',
  category: 'image',
  keywords: ['border', 'radius', 'shadow', '边框', '圆角', '阴影', '图片'],
  icon: 'imageFrame',
  component: () => import('./ImageFrameTool'),
  weight: 17,
};
