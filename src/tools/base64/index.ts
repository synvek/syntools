import type { ToolMeta } from '@/core/types';

export const base64Tool: ToolMeta = {
  id: 'base64',
  name: 'Base64 编解码',
  description: '文本与 Base64 互转，Unicode 安全，支持 URL Safe 与文件模式',
  category: 'encoding',
  keywords: ['base64', 'b64', '编码', '解码', 'encode', 'decode'],
  icon: 'binary',
  component: () => import('./Base64Tool'),
  weight: 1,
};
