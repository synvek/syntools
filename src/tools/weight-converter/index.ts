import type { ToolMeta } from '@/core/types';

export const weightConverterTool: ToolMeta = {
  id: 'weight-converter',
  name: '重量单位转换',
  description: '公制 / 英制重量单位互转（mg、g、kg、t、oz、lb、st）',
  category: 'other',
  keywords: ['weight', 'mass', '重量', '质量', '千克', '磅', '盎司', '单位', '转换'],
  icon: 'weight',
  component: () => import('./WeightConverterTool'),
  weight: 8,
};
