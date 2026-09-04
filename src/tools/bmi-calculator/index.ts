import type { ToolMeta } from '@/core/types';

export const bmiCalculatorTool: ToolMeta = {
  id: 'bmi-calculator',
  name: 'BMI 计算',
  description: '按身高体重计算 BMI，并按 WHO 成人标准分级',
  category: 'other',
  keywords: ['bmi', '体重指数', '肥胖', '健康', 'body mass'],
  icon: 'bmi',
  component: () => import('./BmiCalculatorTool'),
  weight: 20,
};
