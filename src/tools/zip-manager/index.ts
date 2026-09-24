import type { ToolMeta } from '@/core/types';

export const zipManagerTool: ToolMeta = {
  id: 'zip-manager',
  name: 'ZIP 压缩管理',
  description: '将多个文件打包为 ZIP，或解压查看并下载 ZIP 内单个文件（基于 JSZip）',
  category: 'file',
  keywords: ['zip', '压缩包', '打包', '解压', 'archive', 'jszip', '文件'],
  icon: 'archive',
  component: () => import('./ZipManagerTool'),
  relatedIds: ['file-split-merge', 'gzip-tool'],
};
