import type { ToolMeta } from '@/core/types';

export const imageCompressTool: ToolMeta = {
  id: 'image-compress',
  name: '图片压缩',
  description: '纯前端图片压缩与格式转换（PNG / JPEG / WebP），支持缩放与质量调节',
  category: 'image',
  keywords: [
    '图片',
    '压缩',
    '格式转换',
    'image',
    'compress',
    'webp',
    'jpeg',
    'png',
    'resize',
    '缩放',
  ],
  icon: 'image',
  component: () => import('./ImageCompressTool'),
  weight: 3,
};
