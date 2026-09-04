import type { ToolMeta } from '@/core/types';

export const urlCodecTool: ToolMeta = {
  id: 'url-codec',
  name: 'URL 编解码',
  description: 'encodeURIComponent / encodeURI 两种模式互转，非法 % 序列报错',
  category: 'encoding',
  keywords: ['url', 'encode', 'decode', '百分号', '转义', '链接'],
  icon: 'link',
  component: () => import('./UrlCodecTool'),
  weight: 2,
};
