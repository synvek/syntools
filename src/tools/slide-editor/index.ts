import type { ToolMeta } from '@/core/types';

/**
 * 幻灯片编辑器（「文档与创作」分类重工具）：
 * 自研 Canvas（Konva）编辑画布 + 浏览器本地 .pptx 导入导出，数据不离开浏览器。
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
