import type { ToolMeta } from '@/core/types';

export const xmlFormatTool: ToolMeta = {
  id: 'xml-format',
  name: 'XML 格式化 / 压缩',
  description: 'XML 美化与压缩，支持 2/4 空格缩进，保留 CDATA',
  category: 'formatting',
  keywords: ['xml', 'minify', 'beautify', '格式化', '压缩', '美化'],
  icon: 'xml',
  component: () => import('./XmlFormatTool'),
  weight: 7,
};
