import type { ToolMeta } from '@/core/types';

/**
 * Word processor (the first heavyweight tool in the "Documents & Creation" category): TipTap editing +
 * Word (.docx) import/export + two PDF export modes, all done locally in the browser.
 */
export const richTextEditorTool: ToolMeta = {
  id: 'rich-text-editor',
  name: '文字处理器',
  description: '本地文字处理，支持导入导出 Word(.docx) 与两种模式导出 PDF',
  category: 'advanced',
  keywords: [
    'rich text',
    'editor',
    'tiptap',
    'docx',
    'word',
    'pdf',
    '富文本',
    '编辑器',
    '文档',
    '导出',
  ],
  icon: 'richText',
  component: () => import('./RichTextEditorTool'),
  weight: 1,
  relatedIds: ['markdown-preview', 'latex-editor', 'slide-editor'],
};
