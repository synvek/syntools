import type { ToolMeta } from '@/core/types';

export const unitConverterTool: ToolMeta = {
  id: 'unit-converter',
  name: '单位换算',
  description: '长度 / 质量 / 面积 / 体积 / 温度 / 速度 / 数据 / 时间 单位互转',
  category: 'other',
  keywords: ['unit', 'convert', '单位', '换算', '温度', '重量', '面积', '体积', '速度', '数据'],
  icon: 'ruler',
  component: () => import('./UnitConverterTool'),
  relatedIds: ['length-converter', 'hsv-cmyk'],
};
