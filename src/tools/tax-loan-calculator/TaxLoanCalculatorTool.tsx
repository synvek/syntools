import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { calcIncomeTax, calcLoan, formatNumber, type LoanMode } from './core';

type Mode = 'loan' | 'tax';

const inputClass =
  'w-32 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900';

export default function TaxLoanCalculatorTool() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('loan');

  const [principal, setPrincipal] = useState(1000000);
  const [rate, setRate] = useState(3.85);
  const [months, setMonths] = useState(360);
  const [loanMode, setLoanMode] = useState<LoanMode>('equal_payment');

  const [gross, setGross] = useState(20000);
  const [insurance, setInsurance] = useState(2000);
  const [deduction, setDeduction] = useState(1000);

  const loan = useMemo(
    () => calcLoan(principal, rate, months, loanMode),
    [principal, rate, months, loanMode],
  );
  const tax = useMemo(
    () => calcIncomeTax(gross, insurance, deduction),
    [gross, insurance, deduction],
  );

  const money = (n: number) => formatNumber(Math.round(n * 100) / 100);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
          aria-label={t('tools.tax-loan-calculator.mode')}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="loan">{t('tools.tax-loan-calculator.modes.loan')}</option>
          <option value="tax">{t('tools.tax-loan-calculator.modes.tax')}</option>
        </select>
        {mode === 'loan' && (
          <select
            value={loanMode}
            onChange={(e) => setLoanMode(e.target.value as LoanMode)}
            aria-label={t('tools.tax-loan-calculator.loanMode')}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="equal_payment">{t('tools.tax-loan-calculator.equalPayment')}</option>
            <option value="equal_principal">{t('tools.tax-loan-calculator.equalPrincipal')}</option>
          </select>
        )}
      </OptionBar>

      {mode === 'loan' ? (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
            <label className="flex items-center gap-2">
              {t('tools.tax-loan-calculator.principal')}
              <input
                type="number"
                value={principal}
                onChange={(e) => setPrincipal(Number(e.target.value))}
                className={inputClass}
              />
            </label>
            <label className="flex items-center gap-2">
              {t('tools.tax-loan-calculator.rate')}
              <input
                type="number"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className={inputClass}
              />
            </label>
            <label className="flex items-center gap-2">
              {t('tools.tax-loan-calculator.months')}
              <input
                type="number"
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className={inputClass}
              />
            </label>
          </div>

          {!loan.ok && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {t(`tools.tax-loan-calculator.errors.${loan.error}`)}
            </p>
          )}

          {loan.ok && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    label: t('tools.tax-loan-calculator.firstPayment'),
                    value: money(loan.value.firstPayment),
                  },
                  {
                    label: t('tools.tax-loan-calculator.lastPayment'),
                    value: money(loan.value.lastPayment),
                  },
                  {
                    label: t('tools.tax-loan-calculator.totalInterest'),
                    value: money(loan.value.totalInterest),
                  },
                  {
                    label: t('tools.tax-loan-calculator.totalPayment'),
                    value: money(loan.value.totalPayment),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                    <p className="mt-1 font-mono text-sm">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="max-h-72 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2">{t('tools.tax-loan-calculator.period')}</th>
                      <th className="px-3 py-2">{t('tools.tax-loan-calculator.payment')}</th>
                      <th className="px-3 py-2">{t('tools.tax-loan-calculator.principalCol')}</th>
                      <th className="px-3 py-2">{t('tools.tax-loan-calculator.interest')}</th>
                      <th className="px-3 py-2">{t('tools.tax-loan-calculator.balance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loan.value.schedule.map((row) => (
                      <tr
                        key={row.period}
                        className="border-t border-gray-100 dark:border-gray-800"
                      >
                        <td className="px-3 py-1">{row.period}</td>
                        <td className="px-3 py-1 font-mono">{money(row.payment)}</td>
                        <td className="px-3 py-1 font-mono">{money(row.principal)}</td>
                        <td className="px-3 py-1 font-mono">{money(row.interest)}</td>
                        <td className="px-3 py-1 font-mono">{money(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
            <label className="flex items-center gap-2">
              {t('tools.tax-loan-calculator.gross')}
              <input
                type="number"
                value={gross}
                onChange={(e) => setGross(Number(e.target.value))}
                className={inputClass}
              />
            </label>
            <label className="flex items-center gap-2">
              {t('tools.tax-loan-calculator.insurance')}
              <input
                type="number"
                value={insurance}
                onChange={(e) => setInsurance(Number(e.target.value))}
                className={inputClass}
              />
            </label>
            <label className="flex items-center gap-2">
              {t('tools.tax-loan-calculator.deduction')}
              <input
                type="number"
                value={deduction}
                onChange={(e) => setDeduction(Number(e.target.value))}
                className={inputClass}
              />
            </label>
          </div>

          {!tax.ok && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {t(`tools.tax-loan-calculator.errors.${tax.error}`)}
            </p>
          )}

          {tax.ok && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t('tools.tax-loan-calculator.taxable'), value: money(tax.value.taxable) },
                { label: t('tools.tax-loan-calculator.tax'), value: money(tax.value.tax) },
                { label: t('tools.tax-loan-calculator.net'), value: money(tax.value.net) },
                {
                  label: t('tools.tax-loan-calculator.effectiveRate'),
                  value: `${formatNumber(Math.round(tax.value.effectiveRate * 10000) / 100)}%`,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                  <p className="mt-1 font-mono text-sm">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
