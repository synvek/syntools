import type { ToolMeta } from '@/core/types';

export const mimeTypesTool: ToolMeta = {
  id: 'mime-types',
  name: 'MIME 类型速查',
  description: '常见文件扩展名与 MIME 类型对照表，支持搜索与反查',
  category: 'cheatsheet',
  keywords: ['mime', 'content-type', '媒体类型', '扩展名', '速查', 'cheatsheet'],
  icon: 'file',
  component: () => import('./MimeTypesTool'),
  relatedIds: ['http-headers', 'http-status'],
};
