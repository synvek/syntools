import type { ToolMeta } from '@/core/types';

export const svgToPngTool: ToolMeta = {
  id: 'svg-to-png',
  name: '在线 SVG 转 PNG',
  description: '将 SVG 代码或文件转换为 PNG，支持缩放与透明背景',
  category: 'image',
  keywords: ['svg', 'png', '转换', 'convert', '矢量', '导出'],
  icon: 'svgPng',
  component: () => import('./SvgToPngTool'),
  weight: 16,
};
