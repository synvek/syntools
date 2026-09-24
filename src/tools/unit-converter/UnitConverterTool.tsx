import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { OptionBar } from '@/core/components/ActionButtons';
import { CATEGORIES, convertUnit, formatNumber, unitsOf, type UnitCategory } from './core';

export default function UnitConverterTool() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<UnitCategory>('length');
  const [value, setValue] = useState('1');
  const [from, setFrom] = useState('m');

  const units = useMemo(() => unitsOf(category), [category]);
  const effectiveFrom = units.includes(from) ? from : units[0];

  const results = useMemo(
    () =>
      units
        .filter((u) => u !== effectiveFrom)
        .map((u) => {
          const r = convertUnit(value, category, effectiveFrom, u);
          return { unit: u, value: r.ok ? formatNumber(r.value) : '' };
        }),
    [units, effectiveFrom, value, category],
  );

  const error = useMemo(() => {
    if (!value.trim()) return null;
    const r = convertUnit(value, category, effectiveFrom, units[0] ?? effectiveFrom);
    return r.ok ? null : t(`tools.unit-converter.errors.${r.error}`);
  }, [value, category, effectiveFrom, units, t]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.unit-converter.category')}
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as UnitCategory);
              setFrom(unitsOf(e.target.value as UnitCategory)[0]);
            }}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`tools.unit-converter.categories.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.unit-converter.from')}
          <select
            value={effectiveFrom}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
      </OptionBar>

      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode="decimal"
        aria-label={t('tools.unit-converter.value')}
        placeholder={t('tools.unit-converter.placeholder')}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
      />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {results.map((r) => (
          <div key={r.unit} className="flex items-center gap-3 py-2 text-sm">
            <span className="w-16 shrink-0 text-gray-500 dark:text-gray-400">{r.unit}</span>
            <code className="flex-1 truncate">{r.value}</code>
            <CopyButton text={r.value} disabled={!r.value} />
          </div>
        ))}
      </div>
    </div>
  );
}
