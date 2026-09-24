import type { ToolMeta } from '@/core/types';

export const encodingRescueTool: ToolMeta = {
  id: 'encoding-rescue',
  name: '乱码修复',
  description: '用 GBK / Big5 / Shift-JIS 等编码重新解读 UTF-8 误读产生的乱码',
  category: 'encoding',
  keywords: ['乱码', 'mojibake', 'gbk', 'big5', '编码', '修复', 'recovery'],
  icon: 'search',
  component: () => import('./EncodingRescueTool'),
  relatedIds: [],
};
