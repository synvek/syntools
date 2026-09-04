import type { ToolMeta } from '@/core/types';

export const entityCodecTool: ToolMeta = {
  id: 'entity-codec',
  name: 'HTML 编解码',
  description: 'HTML 特殊字符编解码：命名 / 十进制 / 十六进制 / \\u 转义',
  category: 'encoding',
  keywords: [
    'html',
    '实体',
    'entity',
    'unicode',
    '编解码',
    '转义',
    'escape',
    'unescape',
    '编码',
    '解码',
    'encode',
    'decode',
    '&lt;',
    '&amp;',
  ],
  icon: 'binary',
  component: () => import('./EntityCodecTool'),
  weight: 3,
};
