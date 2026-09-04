import type { ToolMeta } from '@/core/types';

export const htmlColorPickerTool: ToolMeta = {
  id: 'html-color-picker',
  name: 'HTML 取色器',
  description: '可视化取色，输出 HEX / RGB / HSL 与 HTML/CSS 片段',
  category: 'other',
  keywords: ['color', 'picker', '取色', '颜色', 'html', 'css', 'hex', 'rgb', 'eyedropper'],
  icon: 'eyedropper',
  component: () => import('./HtmlColorPickerTool'),
  weight: 6,
};
