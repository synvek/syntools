import type { ToolMeta } from '@/core/types';

export const unicodeCodecTool: ToolMeta = {
  id: 'unicode-codec',
  name: 'Unicode 编码转换',
  description: '文本与 \\uXXXX / 码点 / HTML 实体 / UTF-8 字节互转',
  category: 'encoding',
  keywords: ['unicode', 'utf-8', 'utf8', '码点', '转义', '\\u', '编码', '解码', 'entity'],
  icon: 'unicode',
  component: () => import('./UnicodeCodecTool'),
  weight: 5,
};
