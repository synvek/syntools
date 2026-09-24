import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { OptionBar } from '@/core/components/ActionButtons';
import { COMMON_ZONES, convertZones, wallTimeToUtc } from './core';

function nowLocalInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TimezoneConverterTool() {
  const { t } = useTranslation();
  const [wall, setWall] = useState(nowLocalInput);
  const [sourceZone, setSourceZone] = useState('Asia/Shanghai');
  const [targets, setTargets] = useState<string[]>([
    'UTC',
    'Asia/Tokyo',
    'Europe/London',
    'America/New_York',
  ]);

  const result = useMemo(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(wall);
    if (!m) return null;
    const utc = wallTimeToUtc(
      Number(m[1]),
      Number(m[2]),
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      sourceZone,
    );
    return convertZones(utc, [sourceZone, ...targets.filter((z) => z !== sourceZone)]);
  }, [wall, sourceZone, targets]);

  const toggle = (zone: string) => {
    setTargets((prev) => (prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone]));
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.timezone-converter.datetime')}
          <input
            type="datetime-local"
            value={wall}
            onChange={(e) => setWall(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.timezone-converter.sourceZone')}
          <select
            value={sourceZone}
            onChange={(e) => setSourceZone(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {COMMON_ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
      </OptionBar>

      <div className="flex flex-wrap gap-2">
        {COMMON_ZONES.filter((z) => z !== sourceZone).map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => toggle(z)}
            className={`rounded-full border px-3 py-1 text-xs ${
              targets.includes(z)
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300'
            }`}
          >
            {z}
          </button>
        ))}
      </div>

      {result && !result.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.timezone-converter.errors.${result.error}`)}
        </p>
      )}

      {result && result.ok && (
        <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {result.value.map((item) => (
            <div key={item.zone} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-44 shrink-0 text-gray-500 dark:text-gray-400">
                {item.zone}
                {item.zone === sourceZone ? ' *' : ''}
              </span>
              <span className="w-24 shrink-0 font-mono text-xs text-gray-400">{item.offset}</span>
              <code className="flex-1 truncate">{item.local}</code>
              <CopyButton text={item.local} disabled={!item.local} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
