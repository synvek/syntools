import type { ToolMeta } from '@/core/types';

export const urlQueryTool: ToolMeta = {
  id: 'url-query',
  name: 'URL Query 解析',
  description: '解析 URL 各部分与查询参数，编辑后重建',
  category: 'encoding',
  keywords: ["url","query","qs","searchparams","参数"],
  icon: 'link',
  component: () => import('./UrlQueryTool'),
  weight: 4,
};
