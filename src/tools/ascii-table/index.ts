import type { ToolMeta } from '@/core/types';

export const asciiTableTool: ToolMeta = {
  id: 'ascii-table',
  name: 'ASCII 表',
  description: 'ASCII 0–127 对照表，支持按十进制 / 十六进制 / 字符搜索',
  category: 'encoding',
  keywords: ['ascii', 'table', '字符', '对照表', '编码'],
  icon: 'table',
  component: () => import('./AsciiTableTool'),
  weight: 8,
};
