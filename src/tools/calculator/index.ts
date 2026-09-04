import type { ToolMeta } from '@/core/types';

export const calculatorTool: ToolMeta = {
  id: 'calculator',
  name: '在线计算器',
  description: '安全表达式计算，支持四则运算、幂、取余与常用函数',
  category: 'other',
  keywords: ['calculator', 'calc', '计算器', '运算', 'math', '表达式'],
  icon: 'calc',
  component: () => import('./CalculatorTool'),
  weight: 3,
};
