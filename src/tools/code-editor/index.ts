import type { ToolMeta } from '@/core/types';

/**
 * 代码编辑器（「文档与创作」分类）：可编辑的语法高亮编辑器，
 * 支持多语言格式化（Prettier + 内置）、10 套风格主题、
 * 按语言扩展名导出源码 / HTML，以及 PNG / JPG / SVG 图片导出，全部在本地完成。
 */
export const codeEditorTool: ToolMeta = {
  id: 'code-editor',
  name: '代码编辑器',
  description: '语法高亮可编辑代码，支持多语言格式化、10 套风格与源码 / HTML / 图片导出',
  category: 'advanced',
  keywords: [
    'code',
    'editor',
    'ide',
    'prettier',
    'java',
    'rust',
    'highlight',
    '代码',
    '编辑器',
    '格式化',
    '高亮',
    '导出',
  ],
  icon: 'codeEditor',
  component: () => import('./CodeEditorTool'),
  weight: 2,
  relatedIds: ['code-highlight', 'code-image', 'code-minify'],
};
