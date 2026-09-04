import type { ToolMeta } from '@/core/types';

export const cssButtonTool: ToolMeta = {
  id: 'css-button',
  name: 'CSS 按钮生成器',
  description: '可视化调整样式并生成按钮 CSS / HTML 代码',
  category: 'formatting',
  keywords: ['css', 'button', '按钮', '生成器', 'generator', 'style', '样式'],
  icon: 'button',
  component: () => import('./CssButtonTool'),
  weight: 8,
};
