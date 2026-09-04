import type { ToolMeta } from '@/core/types';

export const cssFormatTool: ToolMeta = {
  id: 'css-format',
  name: 'CSS 压缩 / 格式化',
  description: 'CSS 压缩与美化，支持 2/4 空格缩进',
  category: 'formatting',
  keywords: ['css', 'minify', 'beautify', '压缩', '格式化', '美化', '解压', 'stylesheet'],
  icon: 'css',
  component: () => import('./CssFormatTool'),
  weight: 6,
};
