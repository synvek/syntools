import type { ToolMeta } from '@/core/types';

export const httpStatusTool: ToolMeta = {
  id: 'http-status',
  name: 'HTTP 状态码速查',
  description: 'HTTP 状态码大全：分类、标准名称与含义，支持搜索',
  category: 'cheatsheet',
  keywords: ['http', 'status', '状态码', '404', '500', '速查', 'cheatsheet'],
  icon: 'globe',
  component: () => import('./HttpStatusTool'),
  relatedIds: ['http-headers', 'http-request'],
};
