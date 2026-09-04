import type { ToolMeta } from '@/core/types';

export const jsFormatTool: ToolMeta = {
  id: 'js-format',
  name: 'JS 压缩 / 格式化',
  description: 'JavaScript 压缩与美化，支持 2/4 空格缩进',
  category: 'formatting',
  keywords: ['js', 'javascript', 'minify', 'uglify', '压缩', '格式化', '美化', '解压'],
  icon: 'braces',
  component: () => import('./JsFormatTool'),
  weight: 5,
};
