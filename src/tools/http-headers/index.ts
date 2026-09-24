import type { ToolMeta } from '@/core/types';

export const httpHeadersTool: ToolMeta = {
  id: 'http-headers',
  name: '安全响应头生成器',
  description:
    '生成 CSP / HSTS / Referrer-Policy 等安全响应头（nginx / Apache / Express / Vercel）',
  category: 'network',
  keywords: ['http', 'headers', 'csp', 'hsts', 'security', '安全头', 'nginx', 'response'],
  icon: 'shield',
  component: () => import('./HttpHeadersTool'),
  weight: 6,
  relatedIds: ['http-request', 'url-parser'],
};
