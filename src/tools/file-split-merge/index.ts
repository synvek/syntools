import type { ToolMeta } from '@/core/types';

export const fileSplitMergeTool: ToolMeta = {
  id: 'file-split-merge',
  name: '文件切分 / 合并',
  description: '将大文件按大小或数量切分为多个分片，或按文件名顺序合并分片还原',
  category: 'file',
  keywords: ['split', 'merge', '切分', '合并', '分片', '文件', 'file'],
  icon: 'grid',
  component: () => import('./FileSplitMergeTool'),
  relatedIds: ['zip-manager', 'gzip-tool'],
};
