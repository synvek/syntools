import type { ToolMeta } from '@/core/types';

export const imageWatermarkTool: ToolMeta = {
  id: 'image-watermark',
  name: '图片加水印',
  description: '为图片添加文字水印，支持位置、透明度、旋转与平铺',
  category: 'image',
  keywords: ['watermark', '水印', '图片', 'image', 'logo', '版权'],
  icon: 'watermark',
  component: () => import('./ImageWatermarkTool'),
  weight: 11,
};
