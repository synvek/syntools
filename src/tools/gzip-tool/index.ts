import type { ToolMeta } from '@/core/types';

export const gzipTool: ToolMeta = {
  id: 'gzip-tool',
  name: 'Gzip 压缩',
  description: '文本 Gzip 压缩为 base64 / 解压还原',
  category: 'encoding',
  keywords: ["gzip","compress","decompress","压缩","pako"],
  icon: 'database',
  component: () => import('./GzipTool'),
  weight: 6,
};
