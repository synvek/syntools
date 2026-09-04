import type { ToolMeta } from '@/core/types';

export const css3GeneratorTool: ToolMeta = {
  id: 'css3-generator',
  name: 'CSS3 代码生成器',
  description: '可视化生成 border-radius、阴影、transform、filter 等 CSS3',
  category: 'generator',
  keywords: ['css3', 'css', 'border-radius', 'shadow', 'transform', 'filter', '生成器'],
  icon: 'css3',
  component: () => import('./Css3GeneratorTool'),
  weight: 16,
};
