import type { ToolMeta } from '@/core/types';

export const codeMinifyTool: ToolMeta = {
  id: 'code-minify',
  name: '代码压缩',
  description: 'CSS / HTML / JS / JSON 代码压缩（CSS 基于 csso，JS/HTML 为保守实现）',
  category: 'formatting',
  keywords: ['minify', 'compress', '压缩', 'css', 'html', 'js', 'json', 'uglify'],
  icon: 'code',
  component: () => import('./CodeMinifyTool'),
  relatedIds: ['css-format', 'js-format', 'html-format', 'json-format'],
};
