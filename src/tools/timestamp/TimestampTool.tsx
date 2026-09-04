import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { formatTimestamp, parseDate, parseTimestamp, relativeParts } from './core';

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
      <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="truncate font-mono text-sm text-gray-800 dark:text-gray-200">{value}</span>
      <CopyButton text={value} disabled={!value} />
    </div>
  );
}

export default function TimestampTool() {
  const { t } = useTranslation();
  const init = readSharedState({ t: '', d: '' });
  const [now, setNow] = useState(() => Date.now());
  const [ticking, setTicking] = useState(true);
  const [tsInput, setTsInput] = useState(init.t);
  const [dateInput, setDateInput] = useState(init.d);

  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);

  const tsResult = useMemo(() => (tsInput.trim() ? parseTimestamp(tsInput) : null), [tsInput]);
  const dateResult = useMemo(() => (dateInput.trim() ? parseDate(dateInput) : null), [dateInput]);

  const formatted = tsResult?.ok ? formatTimestamp(tsResult.value.ms) : null;
  const currentFormatted = formatTimestamp(now);

  const formatRelative = (ms: number) => {
    const rel = relativeParts(ms, now);
    const unit = t(`tools.timestamp.units.${rel.unit}`);
    return rel.direction === 'ago'
      ? t('tools.timestamp.relativeAgo', { count: rel.count, unit })
      : t('tools.timestamp.relativeLater', { count: rel.count, unit });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <ShareButton getState={() => ({ t: tsInput, d: dateInput })} />
      </div>

      <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {t('tools.timestamp.currentTime')}
          </h2>
          <button
            type="button"
            onClick={() => setTicking((v) => !v)}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            {ticking ? t('tools.timestamp.pauseTick') : t('tools.timestamp.resumeTick')}
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <ResultRow label={t('tools.timestamp.second')} value={String(Math.floor(now / 1000))} />
          <ResultRow label={t('tools.timestamp.millisecond')} value={String(now)} />
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {t('tools.timestamp.localPrefix', {
            local: currentFormatted.local,
            utc: currentFormatted.utc,
          })}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {t('tools.timestamp.tsToReadable')}
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTsInput(String(Math.floor(now / 1000)))}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t('tools.timestamp.fillCurrentSec')}
            </button>
            <ClearButton onClick={() => setTsInput('')} disabled={!tsInput} />
          </div>
        </div>
        <input
          value={tsInput}
          onChange={(e) => setTsInput(e.target.value)}
          placeholder={t('tools.timestamp.tsPlaceholder')}
          aria-label={t('tools.timestamp.tsInput')}
          spellCheck={false}
          className="w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-400 dark:focus:ring-blue-400"
        />
        {tsResult && !tsResult.ok && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {translateToolError('tools.timestamp', tsResult)}
          </p>
        )}
        {tsResult?.ok && formatted && (
          <div className="grid gap-2 sm:grid-cols-2">
            <ResultRow label={t('tools.timestamp.localTime')} value={formatted.local} />
            <ResultRow label="UTC" value={formatted.utc} />
            <ResultRow label="ISO 8601" value={formatted.iso} />
            <ResultRow
              label={t('tools.timestamp.relative', {
                unit:
                  tsResult.value.unit === 'seconds'
                    ? t('tools.timestamp.unitSeconds')
                    : t('tools.timestamp.unitMilliseconds'),
              })}
              value={formatRelative(tsResult.value.ms)}
            />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {t('tools.timestamp.dateToTs')}
          </h2>
          <ClearButton onClick={() => setDateInput('')} disabled={!dateInput} />
        </div>
        <input
          value={dateInput}
          onChange={(e) => setDateInput(e.target.value)}
          placeholder={t('tools.timestamp.datePlaceholder')}
          aria-label={t('tools.timestamp.dateInput')}
          spellCheck={false}
          className="w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-400 dark:focus:ring-blue-400"
        />
        {dateResult && !dateResult.ok && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {translateToolError('tools.timestamp', dateResult)}
          </p>
        )}
        {dateResult?.ok && (
          <div className="grid gap-2 sm:grid-cols-2">
            <ResultRow
              label={t('tools.timestamp.second')}
              value={String(dateResult.value.seconds)}
            />
            <ResultRow
              label={t('tools.timestamp.millisecond')}
              value={String(dateResult.value.milliseconds)}
            />
          </div>
        )}
      </section>
    </div>
  );
}
