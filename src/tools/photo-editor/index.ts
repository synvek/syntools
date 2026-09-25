import type { ToolMeta } from '@/core/types';

/**
 * 照片编辑器（「文档与创作」分类重工具）：
 * Konva 多图层画布 + 浏览器本地的调色 / 滤镜 / 绘制，支持导出 PNG / JPEG / WEBP 与工程文件续编。
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
