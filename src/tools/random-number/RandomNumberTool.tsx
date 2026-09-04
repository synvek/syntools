import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { generateRandomNumbers, MAX_COUNT, MAX_DECIMALS } from './core';

/** 随机数生成器 */
export default function RandomNumberTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () => readSharedState({ min: '1', max: '100', c: 5, d: 0, u: 0 }),
    [],
  );
  const [min, setMin] = useState(String(init.min));
  const [max, setMax] = useState(String(init.max));
  const [count, setCount] = useState(Number(init.c) || 5);
  const [decimals, setDecimals] = useState(Number(init.d) || 0);
  const [unique, setUnique] = useState(Number(init.u) === 1);
  const [tick, setTick] = useState(0);

  const result = useMemo(() => {
    void tick;
    return generateRandomNumbers({
      min: Number(min),
      max: Number(max),
      count,
      decimals,
      unique,
    });
  }, [min, max, count, decimals, unique, tick]);

  const output = result.ok ? result.value.join('\n') : '';

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.randomNumber.min')}
          <input
            type="text"
            inputMode="decimal"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.randomNumber.max')}
          <input
            type="text"
            inputMode="decimal"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.randomNumber.count')}
          <input
            type="number"
            min={1}
            max={MAX_COUNT}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.randomNumber.decimals')}
          <input
            type="number"
            min={0}
            max={MAX_DECIMALS}
            value={decimals}
            onChange={(e) => setDecimals(Number(e.target.value))}
            className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={unique}
            onChange={(e) => setUnique(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          {t('tools.randomNumber.unique')}
        </label>
        <button
          type="button"
          onClick={() => setTick((n) => n + 1)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('tools.randomNumber.generate')}
        </button>
        <ShareButton
          getState={() => ({
            min,
            max,
            c: count,
            d: decimals,
            u: unique ? 1 : 0,
          })}
        />
      </OptionBar>

      {!result.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.randomNumber.err.${result.error}`)}
        </p>
      )}

      <IOTextArea
        label={t('common.result')}
        value={output}
        readOnly
        actions={<CopyButton text={output} disabled={!output} />}
      />
    </div>
  );
}
