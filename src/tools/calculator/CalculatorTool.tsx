import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { evaluateExpression, formatCalcResult } from './core';

type KeyKind = 'num' | 'op' | 'fn' | 'const' | 'act';

interface PadKey {
  id: string;
  label: string;
  insert?: string;
  action?: 'backspace' | 'clear';
  kind: KeyKind;
  span?: 2;
}

const FN_KEYS: PadKey[] = [
  { id: 'sin', label: 'sin', insert: 'sin(', kind: 'fn' },
  { id: 'cos', label: 'cos', insert: 'cos(', kind: 'fn' },
  { id: 'tan', label: 'tan', insert: 'tan(', kind: 'fn' },
  { id: 'ln', label: 'ln', insert: 'ln(', kind: 'fn' },
  { id: 'log', label: 'log', insert: 'log(', kind: 'fn' },
  { id: 'sqrt', label: '√', insert: 'sqrt(', kind: 'fn' },
  { id: 'abs', label: 'abs', insert: 'abs(', kind: 'fn' },
  { id: 'floor', label: '⌊⌋', insert: 'floor(', kind: 'fn' },
  { id: 'ceil', label: '⌈⌉', insert: 'ceil(', kind: 'fn' },
  { id: 'round', label: 'rnd', insert: 'round(', kind: 'fn' },
];

const MAIN_KEYS: PadKey[] = [
  { id: 'lp', label: '(', insert: '(', kind: 'op' },
  { id: 'rp', label: ')', insert: ')', kind: 'op' },
  { id: 'pow', label: '^', insert: '^', kind: 'op' },
  { id: 'mod', label: '%', insert: '%', kind: 'op' },
  { id: 'back', label: '⌫', action: 'backspace', kind: 'act' },
  { id: '7', label: '7', insert: '7', kind: 'num' },
  { id: '8', label: '8', insert: '8', kind: 'num' },
  { id: '9', label: '9', insert: '9', kind: 'num' },
  { id: 'div', label: '÷', insert: '/', kind: 'op' },
  { id: 'pi', label: 'π', insert: 'pi', kind: 'const' },
  { id: '4', label: '4', insert: '4', kind: 'num' },
  { id: '5', label: '5', insert: '5', kind: 'num' },
  { id: '6', label: '6', insert: '6', kind: 'num' },
  { id: 'mul', label: '×', insert: '*', kind: 'op' },
  { id: 'e', label: 'e', insert: 'e', kind: 'const' },
  { id: '1', label: '1', insert: '1', kind: 'num' },
  { id: '2', label: '2', insert: '2', kind: 'num' },
  { id: '3', label: '3', insert: '3', kind: 'num' },
  { id: 'sub', label: '−', insert: '-', kind: 'op' },
  { id: 'clear', label: 'C', action: 'clear', kind: 'act' },
  { id: '0', label: '0', insert: '0', kind: 'num', span: 2 },
  { id: 'dot', label: '.', insert: '.', kind: 'num' },
  { id: 'add', label: '+', insert: '+', kind: 'op', span: 2 },
];

function keyClass(kind: KeyKind, span?: 2): string {
  const base =
    'min-h-[3.25rem] rounded-xl border text-lg font-medium transition-colors active:scale-[0.98] disabled:opacity-40';
  const spanCls = span === 2 ? ' col-span-2' : '';
  if (kind === 'num') {
    return `${base}${spanCls} border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700`;
  }
  if (kind === 'op') {
    return `${base}${spanCls} border-blue-200 bg-blue-50 font-mono text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900`;
  }
  if (kind === 'fn') {
    return `${base}${spanCls} border-violet-200 bg-violet-50 font-mono text-sm text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200 dark:hover:bg-violet-900`;
  }
  if (kind === 'const') {
    return `${base}${spanCls} border-emerald-200 bg-emerald-50 font-mono text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900`;
  }
  return `${base}${spanCls} border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900`;
}

/** 在线计算器 */
export default function CalculatorTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ e: '' }), []);
  const [expr, setExpr] = useState(init.e);
  const result = useMemo(() => evaluateExpression(expr), [expr]);
  const display = result.ok ? formatCalcResult(result.value) : '';

  const append = (token: string) => setExpr((prev) => prev + token);
  const backspace = () => setExpr((prev) => prev.slice(0, -1));

  const press = (key: PadKey) => {
    if (key.action === 'backspace') {
      backspace();
      return;
    }
    if (key.action === 'clear') {
      setExpr('');
      return;
    }
    if (key.insert) append(key.insert);
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <ClearButton onClick={() => setExpr('')} disabled={!expr} />
        <ShareButton getState={() => ({ e: expr })} />
      </OptionBar>

      <div className="mx-auto w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('tools.calculator.expression')}
        </label>
        <input
          type="text"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault();
          }}
          placeholder={t('tools.calculator.placeholder')}
          spellCheck={false}
          className="mb-3 w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 font-mono text-xl focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950"
        />

        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-950">
          <span className="text-sm text-gray-500">{t('common.result')}</span>
          <code className="min-w-0 flex-1 truncate text-right font-mono text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {result.ok ? display : expr.trim() ? '—' : ''}
          </code>
          <CopyButton text={display} disabled={!result.ok} />
        </div>

        {!result.ok && expr.trim() && (
          <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
            {t(`tools.calculator.err.${result.error}`)}
          </p>
        )}

        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {t('tools.calculator.functions')}
        </p>
        <div className="mb-3 grid grid-cols-5 gap-2">
          {FN_KEYS.map((key) => (
            <button
              key={key.id}
              type="button"
              title={key.insert}
              onClick={() => press(key)}
              className={keyClass(key.kind)}
            >
              {key.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-2">
          {MAIN_KEYS.map((key) => (
            <button
              key={key.id}
              type="button"
              title={key.insert ?? key.label}
              onClick={() => press(key)}
              className={keyClass(key.kind, key.span)}
            >
              {key.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500">
        {t('tools.calculator.hint')}
      </p>
    </div>
  );
}
