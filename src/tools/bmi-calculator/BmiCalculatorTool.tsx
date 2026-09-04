import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { computeBmi, type BmiUnit } from './core';

/** BMI 计算器 */
export default function BmiCalculatorTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ h: '170', w: '65', u: 'metric' }), []);
  const [height, setHeight] = useState(String(init.h || '170'));
  const [weight, setWeight] = useState(String(init.w || '65'));
  const [unit, setUnit] = useState<BmiUnit>(init.u === 'imperial' ? 'imperial' : 'metric');

  const result = useMemo(() => computeBmi(height, weight, unit), [height, weight, unit]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.bmi.unit')}
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as BmiUnit)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="metric">{t('tools.bmi.metric')}</option>
            <option value="imperial">{t('tools.bmi.imperial')}</option>
          </select>
        </label>
        <ShareButton getState={() => ({ h: height, w: weight, u: unit })} />
      </OptionBar>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
          {unit === 'metric' ? t('tools.bmi.heightCm') : t('tools.bmi.heightIn')}
          <input
            type="text"
            inputMode="decimal"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
          {unit === 'metric' ? t('tools.bmi.weightKg') : t('tools.bmi.weightLb')}
          <input
            type="text"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
      </div>

      {!result.ok && (height.trim() || weight.trim()) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.bmi.err.${result.error}`)}
        </p>
      )}

      {result.ok && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.bmi.bmi')}</p>
          <p className="mt-1 font-mono text-3xl font-semibold text-gray-900 dark:text-gray-50">
            {result.value.bmi}
          </p>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
            {t('tools.bmi.category')}:{' '}
            <span className="font-medium">{t(`tools.bmi.categories.${result.value.category}`)}</span>
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {result.value.kg} kg · {result.value.meters} m
          </p>
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">{t('tools.bmi.hint')}</p>
        </div>
      )}
    </div>
  );
}
