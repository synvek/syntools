import type { ToolMeta } from '@/core/types';

export const jsonConvertTool: ToolMeta = {
  id: 'json-convert',
  name: 'JSON 转换',
  description: '将 JSON 解析并转换为 YAML / XML / CSV',
  category: 'formatting',
  keywords: ['json', 'yaml', 'xml', 'csv', '转换', 'convert', '解析'],
  icon: 'braces',
  component: () => import('./JsonConvertTool'),
  weight: 2,
};
