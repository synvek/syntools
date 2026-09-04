import type { ToolMeta } from '@/core/types';

export const lengthConverterTool: ToolMeta = {
  id: 'length-converter',
  name: '长度单位转换',
  description: '公制 / 英制长度单位互转（mm、cm、m、km、in、ft 等）',
  category: 'other',
  keywords: ['length', 'unit', '长度', '单位', '米', '英尺', '英寸', '公里', 'convert'],
  icon: 'ruler',
  component: () => import('./LengthConverterTool'),
  weight: 7,
};
