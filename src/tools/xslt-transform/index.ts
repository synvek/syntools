import type { ToolMeta } from '@/core/types';

export const xsltTransformTool: ToolMeta = {
  id: 'xslt-transform',
  name: 'XSLT 转换',
  description: '用 XSLT 将 XML 转换为 HTML，浏览器本地完成',
  category: 'formatting',
  keywords: ['xslt', 'xml', 'html', 'transform', '转换', 'stylesheet'],
  icon: 'xslt',
  component: () => import('./XsltTransformTool'),
  weight: 26,
};
