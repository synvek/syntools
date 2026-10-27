import type { ToolMeta } from '@/core/types';

/**
 * Code editor ("Documents & creation" category): an editable syntax-highlighted editor.
 * Editing: find and replace (case / whole word / regex), line operations and shortcuts, indent
 * guides, bracket matching and jumping, fold-range markers, batch replacement (select same word),
 * current-line highlight.
 * Output: multi-language formatting (Prettier + built-in), 10 themes, styled export cards
 * (window style / padding / radius / shadow / background / watermark / line highlight / line
 * numbers), source / standalone HTML / PNG / JPG / SVG export, copying Markdown / rich text /
 * images, and compressed share links plus local drafts — all done locally.
 */
export const codeEditorTool: ToolMeta = {
  id: 'code-editor',
  name: '代码编辑器',
  description:
    '可编辑语法高亮：查找替换、行操作、括号配对、折叠、批量编辑，10 套主题与样式化卡片导出',
  category: 'advanced',
  keywords: [
    'code',
    'editor',
    'ide',
    'prettier',
    'java',
    'rust',
    'highlight',
    'find',
    'replace',
    'fold',
    'watermark',
    '代码',
    '编辑器',
    '格式化',
    '高亮',
    '查找替换',
    '折叠',
    '水印',
    '导出',
  ],
  icon: 'codeEditor',
  component: () => import('./CodeEditorTool'),
  weight: 7,
  relatedIds: ['code-highlight', 'code-image', 'code-minify'],
};
