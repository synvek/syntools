import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { WEIGHT_UNITS, convertWeightAll, type WeightUnit } from './core';

const UNIT_SET = new Set<string>(WEIGHT_UNITS);

/** 重量单位转换 */
export default function WeightConverterTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ v: '1', f: 'kg' }), []);
  const [value, setValue] = useState(init.v);
  const [from, setFrom] = useState<WeightUnit>(
    UNIT_SET.has(init.f) ? (init.f as WeightUnit) : 'kg',
  );

  const result = useMemo(() => convertWeightAll(value, from), [value, from]);
  const rows = result.ok ? result.value : null;

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.weight.value')}
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('tools.weight.placeholder')}
            className="w-36 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.weight.from')}
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value as WeightUnit)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            {WEIGHT_UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`tools.weight.units.${u}`)}
              </option>
            ))}
          </select>
        </label>
        <ClearButton onClick={() => setValue('')} disabled={!value} />
        <ShareButton getState={() => ({ v: value, f: from })} />
      </OptionBar>

      {!result.ok && value.trim() && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.weight.err.${result.error}`)}
        </p>
      )}

      {rows && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {WEIGHT_UNITS.map((unit) => (
            <div
              key={unit}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                unit === from
                  ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <span className="w-16 shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t(`tools.weight.units.${unit}`)}
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-sm text-gray-800 dark:text-gray-100">
                {rows[unit]}
              </code>
              <CopyButton text={rows[unit]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
