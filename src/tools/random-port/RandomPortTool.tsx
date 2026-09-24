import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { DownloadButton } from '@/core/components/ActionButtons';
import { randomIpv6, randomMac, randomPorts, randomPrivateIpv4 } from './core';

export default function RandomPortTool() {
  const { t } = useTranslation();
  const [count, setCount] = useState(5);
  const [min, setMin] = useState(1024);
  const [max, setMax] = useState(65535);
  const [unique, setUnique] = useState(true);
  const [excludeSystem, setExcludeSystem] = useState(true);
  const [ports, setPorts] = useState<number[]>([]);
  const [mac, setMac] = useState('');
  const [ipv4, setIpv4] = useState('');
  const [ipv6, setIpv6] = useState('');
  const [error, setError] = useState('');

  const generate = () => {
    setError('');
    const result = randomPorts({ count, min, max, unique, excludeSystem });
    if (!result.ok) {
      setError(t(`tools.random-port.err.${result.error}`));
      return;
    }
    setPorts(result.value);
    setMac(randomMac(Math.random));
    setIpv4(randomPrivateIpv4(Math.random));
    setIpv6(randomIpv6(Math.random));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.random-port.count')}
          <input
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
            className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.random-port.range')}
          <span className="flex items-center gap-1">
            <input
              type="number"
              value={min}
              onChange={(e) => setMin(Number(e.target.value) || 0)}
              className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            <span>–</span>
            <input
              type="number"
              value={max}
              onChange={(e) => setMax(Number(e.target.value) || 0)}
              className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} />
          {t('tools.random-port.unique')}
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={excludeSystem}
            onChange={(e) => setExcludeSystem(e.target.checked)}
          />
          {t('tools.random-port.excludeSystem')}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generate}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('tools.random-port.generate')}
        </button>
        {ports.length > 0 && (
          <>
            <CopyButton text={ports.join(', ')} />
            <DownloadButton content={ports.join('\n')} filename="ports.txt" />
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {ports.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {t('tools.random-port.ports')}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-3">
            {ports.map((p, i) => (
              <li
                key={`${p}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
              >
                <code className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {p}
                </code>
                <CopyButton text={String(p)} />
              </li>
            ))}
          </ul>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="IPv4" value={ipv4} />
            <Field label="MAC" value={mac} />
            <Field label="IPv6" value={ipv6} />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700">
      <div className="min-w-0">
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <code className="break-all font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
          {value}
        </code>
      </div>
      <CopyButton text={value} />
    </div>
  );
}
