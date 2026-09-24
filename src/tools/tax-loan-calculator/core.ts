import type { ToolResult } from '@/core/types';

export type LoanMode = 'equal_payment' | 'equal_principal';

export interface ScheduleRow {
  period: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface LoanResult {
  firstPayment: number;
  lastPayment: number;
  totalPayment: number;
  totalInterest: number;
  schedule: ScheduleRow[];
}

/** 房贷/贷款还款计划：等额本息或等额本金。annualRatePct 为年利率（%）。 */
export function calcLoan(
  principal: number,
  annualRatePct: number,
  months: number,
  mode: LoanMode = 'equal_payment',
): ToolResult<LoanResult> {
  if (!Number.isFinite(principal) || principal <= 0)
    return { ok: false, error: 'INVALID_PRINCIPAL' };
  if (!Number.isFinite(months) || months < 1 || months > 1200)
    return { ok: false, error: 'INVALID_MONTHS' };
  if (!Number.isFinite(annualRatePct) || annualRatePct < 0)
    return { ok: false, error: 'INVALID_RATE' };

  const n = Math.round(months);
  const r = annualRatePct / 100 / 12;
  const schedule: ScheduleRow[] = [];
  let balance = principal;

  if (mode === 'equal_principal') {
    const principalPart = principal / n;
    for (let i = 1; i <= n; i += 1) {
      const interest = balance * r;
      const payment = principalPart + interest;
      balance -= principalPart;
      schedule.push({
        period: i,
        payment,
        principal: principalPart,
        interest,
        balance: Math.max(0, balance),
      });
    }
  } else {
    const payment = r === 0 ? principal / n : (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1);
    for (let i = 1; i <= n; i += 1) {
      const interest = balance * r;
      const principalPart = Math.min(payment - interest, balance);
      balance -= principalPart;
      schedule.push({
        period: i,
        payment: principalPart + interest,
        principal: principalPart,
        interest,
        balance: Math.max(0, balance),
      });
    }
  }

  const totalPayment = schedule.reduce((sum, row) => sum + row.payment, 0);
  return {
    ok: true,
    value: {
      firstPayment: schedule[0].payment,
      lastPayment: schedule[schedule.length - 1].payment,
      totalPayment,
      totalInterest: totalPayment - principal,
      schedule,
    },
  };
}

/** 数值格式化：去除多余尾零，极大/极小值用科学计数法。 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-6)) {
    return n.toExponential(6).replace(/\.?0+e/, 'e');
  }
  const fixed = n.toFixed(8).replace(/\.?0+$/, '');
  return fixed === '-0' ? '0' : fixed;
}

export interface TaxBracket {
  limit: number;
  rate: number;
  deduction: number;
}

/** 个人所得税月度税率表（综合所得，速算扣除数法） */
export const TAX_BRACKETS: TaxBracket[] = [
  { limit: 3000, rate: 0.03, deduction: 0 },
  { limit: 12000, rate: 0.1, deduction: 210 },
  { limit: 25000, rate: 0.2, deduction: 1410 },
  { limit: 35000, rate: 0.25, deduction: 2660 },
  { limit: 55000, rate: 0.3, deduction: 4410 },
  { limit: 80000, rate: 0.35, deduction: 7160 },
  { limit: Infinity, rate: 0.45, deduction: 15160 },
];

export interface TaxResult {
  taxable: number;
  tax: number;
  net: number;
  effectiveRate: number;
}

/** 工资薪金个税估算（按月度速算扣除数，非累计预扣）。threshold 默认 5000。 */
export function calcIncomeTax(
  gross: number,
  socialInsurance = 0,
  specialDeductions = 0,
  threshold = 5000,
): ToolResult<TaxResult> {
  if (!Number.isFinite(gross) || gross < 0) return { ok: false, error: 'INVALID_GROSS' };
  if (!Number.isFinite(socialInsurance) || socialInsurance < 0)
    return { ok: false, error: 'INVALID_DEDUCTION' };
  if (!Number.isFinite(specialDeductions) || specialDeductions < 0)
    return { ok: false, error: 'INVALID_DEDUCTION' };
  if (!Number.isFinite(threshold) || threshold < 0)
    return { ok: false, error: 'INVALID_DEDUCTION' };

  const taxable = Math.max(0, gross - socialInsurance - specialDeductions - threshold);
  const bracket =
    TAX_BRACKETS.find((b) => taxable <= b.limit) ?? TAX_BRACKETS[TAX_BRACKETS.length - 1];
  const tax = Math.max(0, taxable * bracket.rate - bracket.deduction);
  return {
    ok: true,
    value: {
      taxable,
      tax,
      net: gross - socialInsurance - tax,
      effectiveRate: gross > 0 ? tax / gross : 0,
    },
  };
}
