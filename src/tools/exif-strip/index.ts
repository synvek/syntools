import type { ToolMeta } from '@/core/types';

export const exifStripTool: ToolMeta = {
  id: 'exif-strip',
  name: 'EXIF 清除',
  description: 'JPEG 读取基础 EXIF 并剥离 APP1，下载无 EXIF 文件',
  category: 'image',
  keywords: ["exif","jpeg","metadata","隐私","strip"],
  icon: 'image',
  component: () => import('./ExifStripTool'),
  weight: 12,
};
