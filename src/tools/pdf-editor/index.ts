import type { ToolMeta } from '@/core/types';

/**
 * PDF editor: open, edit and save a PDF locally, built on the shared Office ribbon.
 *
 * The description intentionally does not promise PDF→Word yet: `pdf转word` keywords and the export
 * copy are added in M4 when the feature exists.
 */
export const pdfEditorTool: ToolMeta = {
  id: 'pdf-editor',
  name: 'PDF 编辑器',
  description: '本地打开、编辑并保存 PDF，不上传文件',
  category: 'pdf',
  keywords: ['pdf editor', 'edit pdf', 'pdf编辑', '编辑pdf', '改pdf', '保存pdf'],
  icon: 'pdfEdit',
  component: () => import('./PdfEditorTool'),
  // First in the PDF category: it is the "open and edit" entry, the single-purpose tools follow.
  weight: 0,
  relatedIds: ['pdf-viewer', 'pdf-annotate', 'pdf-merge', 'rich-text-editor'],
};
