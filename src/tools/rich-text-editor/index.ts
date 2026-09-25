import type { ToolMeta } from '@/core/types';

/**
 * 文字处理器（「文档与创作」分类首个重工具）：TipTap 编辑 + Word(.docx) 导入导出
 * + 两种模式 PDF 导出，全部在浏览器本地完成。
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
