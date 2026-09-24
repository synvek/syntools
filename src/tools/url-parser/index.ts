import type { ToolMeta } from '@/core/types';

export const urlParserTool: ToolMeta = {
  id: 'url-parser',
  name: 'URL 解析器',
  description: '拆解 URL 的协议、主机、端口、路径、查询参数与锚点',
  category: 'network',
  keywords: ['url', '解析', 'parse', 'query', '链接', 'uri', 'host', 'port'],
  icon: 'link',
  component: () => import('./UrlParserTool'),
  weight: 4,
  relatedIds: ['http-headers', 'http-request'],
};
