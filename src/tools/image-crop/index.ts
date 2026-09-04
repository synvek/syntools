import type { ToolMeta } from '@/core/types';

export const imageCropTool: ToolMeta = {
  id: 'image-crop',
  name: '在线图片裁剪',
  description: '按自由框或固定比例裁剪图片并导出 PNG',
  category: 'image',
  keywords: ['crop', '裁剪', '切图', 'aspect', '比例'],
  icon: 'imageCrop',
  component: () => import('./ImageCropTool'),
  weight: 20,
};
