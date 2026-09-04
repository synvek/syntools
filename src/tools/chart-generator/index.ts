import type { ToolMeta } from '@/core/types';

export const chartGeneratorTool: ToolMeta = {
  id: 'chart-generator',
  name: '在线图表生成器',
  description: 'CSV 生成柱状/条形/折线/面积/饼/环/散点图，含图例、坐标轴与配色预设',
  category: 'generator',
  keywords: ['chart', '图表', 'bar', 'line', 'pie', 'svg', 'csv', '生成器', '图例', '配色'],
  icon: 'chart',
  component: () => import('./ChartGeneratorTool'),
  weight: 18,
};
