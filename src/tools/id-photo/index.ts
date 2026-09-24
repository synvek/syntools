import type { ToolMeta } from '@/core/types';

export const idPhotoTool: ToolMeta = {
  id: 'id-photo',
  name: '证件照制作',
  description: '按 1 寸 / 2 寸 / 护照等标准尺寸裁剪证件照，可设背景色与 DPI',
  category: 'image',
  keywords: ['id', 'photo', '证件照', '一寸', '二寸', '护照', '照片', '裁剪'],
  icon: 'image',
  component: () => import('./IdPhotoTool'),
  relatedIds: ['image-crop', 'image-frame'],
};
