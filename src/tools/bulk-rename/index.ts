import type { ToolMeta } from '@/core/types';

export const bulkRenameTool: ToolMeta = {
  id: 'bulk-rename',
  name: '批量重命名',
  description: '按前后缀、查找替换（支持正则）、编号、扩展名与大小写规则批量生成新文件名',
  category: 'file',
  keywords: ['rename', 'batch', '批量', '重命名', '编号', '文件名', 'file'],
  icon: 'tag',
  component: () => import('./BulkRenameTool'),
  relatedIds: ['file-split-merge', 'zip-manager'],
};
