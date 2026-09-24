import type { ToolMeta } from '@/core/types';

export const taxLoanCalculatorTool: ToolMeta = {
  id: 'tax-loan-calculator',
  name: '贷款 / 个税计算',
  description: '房贷等额本息 / 等额本金还款计划与工资薪金个税估算',
  category: 'other',
  keywords: ['loan', 'mortgage', 'tax', '贷款', '房贷', '还款', '个税', '利率', '计算器'],
  icon: 'calculator',
  component: () => import('./TaxLoanCalculatorTool'),
  relatedIds: ['bmi-calculator'],
};
