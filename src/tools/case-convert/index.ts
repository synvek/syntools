import type { ToolMeta } from '@/core/types';

export const caseConvertTool: ToolMeta = {
  id: 'case-convert',
  name: '字母大小写转换',
  description: '大小写、标题句式与 camel / snake / kebab 等命名风格互转',
  category: 'text',
  keywords: ['case', 'upper', 'lower', 'camel', 'snake', 'kebab', '大小写', '驼峰'],
  icon: 'caseConvert',
  component: () => import('./CaseConvertTool'),
  weight: 12,
};
