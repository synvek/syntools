import type { ToolMeta } from '@/core/types';

export const webColorTableTool: ToolMeta = {
  id: 'web-color-table',
  name: 'Web 颜色表',
  description: 'CSS 命名颜色对照表，支持分类筛选与复制名称 / HEX / RGB',
  category: 'other',
  keywords: [
    'web',
    'color',
    '颜色表',
    'css',
    'named colors',
    'html',
    'hex',
    'rgb',
    '色板',
    'palette',
  ],
  icon: 'web-color-table',
  component: () => import('./WebColorTableTool'),
  weight: 7,
};
