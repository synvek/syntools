import type { ToolMeta } from '@/core/types';

/**
 * Photo editor (a heavyweight tool in the "Documents & Creation" category):
 * Konva multi-layer canvas with browser-local color / filter / paint, exporting PNG / JPEG / WEBP and a project file for continued editing.
 */
export const photoEditorTool: ToolMeta = {
  id: 'photo-editor',
  name: '照片编辑器',
  description: '浏览器本地多图层修图：图层、选区、裁剪、调色滤镜、画笔文字与工程文件续编',
  category: 'advanced',
  keywords: [
    'photo',
    'photopea',
    'photoshop',
    'image editor',
    'layer',
    'filter',
    'retouch',
    '照片编辑器',
    '修图',
    '图层',
    '滤镜',
    '抠图',
    '调色',
  ],
  icon: 'photoEditor',
  component: () => import('./PhotoTool'),
  weight: 5,
  relatedIds: ['image-adjust', 'image-crop', 'image-watermark', 'doodle-board'],
};
