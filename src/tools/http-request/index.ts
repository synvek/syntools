import type { ToolMeta } from '@/core/types';

export const httpRequestTool: ToolMeta = {
  id: 'http-request',
  name: 'HTTP 请求调试器',
  description: '浏览器内发起 HTTP 请求，查看状态码、耗时、响应头与正文（注意 CORS 限制）',
  category: 'network',
  keywords: ['http', 'request', 'fetch', 'api', '调试', 'curl', '请求'],
  icon: 'terminal',
  component: () => import('./HttpRequestTool'),
  weight: 7,
  relatedIds: ['http-headers', 'websocket-tester'],
};
