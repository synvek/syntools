import type { ToolMeta } from '@/core/types';

export const htmlFormatTool: ToolMeta = {
  id: 'html-format',
  name: 'HTML 压缩 / 格式化',
  description: 'HTML 压缩与美化，支持 2/4 空格缩进',
  category: 'formatting',
  keywords: ['html', 'minify', 'beautify', '压缩', '格式化', '美化', '解压'],
  icon: 'html',
  component: () => import('./HtmlFormatTool'),
  weight: 4,
};
