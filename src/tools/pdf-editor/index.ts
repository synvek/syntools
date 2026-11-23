import type { ToolMeta } from '@/core/types';

/**
 * PDF editor: open, edit and save a PDF locally, built on the shared Office ribbon.
 *
 * The description lists what actually shipped, because it doubles as the page's meta description
 * and as the `llms.txt` line: editable project save, flat PDF export, Word/images/text export,
 * annotation and page operations. Anything not built yet stays out of it.
 */
export const pdfEditorTool: ToolMeta = {
  id: 'pdf-editor',
  name: 'PDF 编辑器',
  description:
    '在浏览器里编辑 PDF：改原文、加批注形状与签名、调页面，存成可继续编辑的工程或导出扁平 PDF，不上传文件',
  category: 'pdf',
  keywords: [
    'pdf editor',
    'edit pdf',
    'pdf编辑',
    '编辑pdf',
    '改pdf',
    '保存pdf',
    'pdf转word',
    'pdf to word',
    'pdf批注',
    'pdf annotate',
    'pdf签名',
    'pdf页面编辑',
  ],
  icon: 'pdfEdit',
  component: () => import('./PdfEditorTool'),
  // First in the PDF category: it is the "open and edit" entry, the single-purpose tools follow.
  weight: 0,
  relatedIds: [
    'pdf-viewer',
    'pdf-annotate',
    'pdf-add-text',
    'pdf-merge',
    'pdf-sign',
    'rich-text-editor',
  ],
};
