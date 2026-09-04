import type { ToolMeta } from '@/core/types';

export const imageCardTool: ToolMeta = {
  id: 'image-card',
  name: '图片转卡片',
  description: '图文一体卡片：标题/副标题、背景预设或渐变、照片旋转并导出 PNG',
  category: 'image',
  keywords: ['card', '图片卡片', '相框', '分享图', 'image card', '海报', '渐变'],
  icon: 'imageCard',
  component: () => import('./ImageCardTool'),
  weight: 17,
};
