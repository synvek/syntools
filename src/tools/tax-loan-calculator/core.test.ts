import { describe, expect, it } from 'vitest';
import { calcIncomeTax, calcLoan } from './core';

describe('tax-loan-calculator 贷款', () => {
  it('零利率等额本息', () => {
    const r = calcLoan(120000, 0, 12, 'equal_payment');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Math.round(r.value.firstPayment)).toBe(10000);
    expect(Math.round(r.value.totalPayment)).toBe(120000);
    expect(r.value.schedule).toHaveLength(12);
    expect(Math.round(r.value.schedule[11].balance)).toBe(0);
  });

  it('等额本息总额 = 本金 + 利息', () => {
    const r = calcLoan(100000, 6, 12, 'equal_payment');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.totalPayment).toBeCloseTo(100000 + r.value.totalInterest, 6);
    expect(r.value.totalInterest).toBeGreaterThan(0);
  });

  it('等额本金逐月递减', () => {
    const r = calcLoan(120000, 6, 12, 'equal_principal');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.firstPayment).toBeGreaterThan(r.value.lastPayment);
    expect(r.value.schedule[11].balance).toBeCloseTo(0, 6);
    expect(r.value.schedule[0].principal).toBeCloseTo(10000, 6);
  });

  it('非法参数报错', () => {
    expect(calcLoan(0, 6, 12).ok).toBe(false);
    expect(calcLoan(1000, 6, 0).ok).toBe(false);
    expect(calcLoan(1000, -1, 12).ok).toBe(false);
  });
});

describe('tax-loan-calculator 个税', () => {
  it('未达起征点免税', () => {
    const r = calcIncomeTax(5000);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.taxable).toBe(0);
      expect(r.value.tax).toBe(0);
    }
  });

  it('第一档税率 3%', () => {
    const r = calcIncomeTax(8000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(Math.round(r.value.tax)).toBe(90); // 3000 * 3%
  });

  it('第二档税率 10% 减扣除数', () => {
    const r = calcIncomeTax(17000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(Math.round(r.value.tax)).toBe(990); // 12000*0.1-210
  });

  it('社保与专项扣除降低税基', () => {
    const a = calcIncomeTax(20000);
    const b = calcIncomeTax(20000, 2000, 1000);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(b.value.tax).toBeLessThan(a.value.tax);
  });

  it('非法输入报错', () => {
    expect(calcIncomeTax(-1).ok).toBe(false);
    expect(calcIncomeTax(10000, -5).ok).toBe(false);
  });
});
