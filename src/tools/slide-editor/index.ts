import type { ToolMeta } from '@/core/types';

/**
 * Slide editor (a heavy tool in the "Documents & Creation" category):
 * a hand-built Canvas (Konva) editing surface + browser-local .pptx import/export; data never leaves the browser.
 */
export const slideEditorTool: ToolMeta = {
  id: 'slide-editor',
  name: '幻灯片编辑器',
  description: '本地 Canvas 编辑幻灯片，支持 PPTX(.pptx) 导入导出与放映预览',
  category: 'advanced',
  keywords: [
    'slide',
    'slides',
    'presentation',
    'pptx',
    'powerpoint',
    'konva',
    '幻灯片',
    '演示文稿',
    'PPT',
    '放映',
  ],
  icon: 'slides',
  component: () => import('./SlideTool'),
  weight: 3,
  relatedIds: ['rich-text-editor', 'spreadsheet-editor', 'latex-editor'],
};
