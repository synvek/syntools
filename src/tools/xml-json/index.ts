import type { ToolMeta } from '@/core/types';

export const xmlJsonTool: ToolMeta = {
  id: 'xml-json',
  name: 'XML 转 JSON',
  description: '将 XML 解析为 JSON，保留属性（@_ 前缀）',
  category: 'formatting',
  keywords: ['xml', 'json', '转换', 'convert', 'parse', '解析'],
  icon: 'xml',
  component: () => import('./XmlJsonTool'),
  weight: 8,
};
