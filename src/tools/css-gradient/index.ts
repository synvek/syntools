import type { ToolMeta } from '@/core/types';

export const cssGradientTool: ToolMeta = {
  id: 'css-gradient',
  name: 'CSS 渐变生成器',
  description: '可视化编辑 linear / radial 渐变，含分类预设与 CSS 复制',
  category: 'generator',
  keywords: ['css', 'gradient', '渐变', 'linear', 'radial', 'background', '预设'],
  icon: 'css-gradient',
  component: () => import('./CssGradientTool'),
  weight: 10,
};
