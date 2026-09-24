import type { ToolMeta } from '@/core/types';

export const imageAsciiTool: ToolMeta = {
  id: 'image-ascii',
  name: '图片转 ASCII',
  description: '将图片转换为 ASCII 字符画，支持多种字符集、宽度与反色',
  category: 'image',
  keywords: ['ascii', '字符画', '图片', 'image', 'art', '转换'],
  icon: 'image',
  component: () => import('./ImageAsciiTool'),
  relatedIds: ['image-compress', 'code-image'],
};
