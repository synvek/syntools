import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { consumeHandoff } from '@/core/lib/handoff';
import { analyzeMac, generateMacs, type MacInfo, type MacSeparator } from './core';

const FLAGS: Array<[keyof MacInfo, string]> = [
  ['isMulticast', 'multicast'],
  ['isLocallyAdministered', 'locallyAdministered'],
  ['isBroadcast', 'broadcast'],
  ['vendor', 'vendor'],
  ['oui', 'oui'],
  ['eui64', 'eui64'],
  ['linkLocal', 'linkLocal'],
];

export default function MacAddressTool() {
  const { t } = useTranslation();
  const init = useMemo(() => {
    const shared = readSharedState({ i: '' });
    const handoff = consumeHandoff('mac-address');
    return { i: handoff ?? shared.i };
  }, []);
  const [input, setInput] = useState(init.i);
  const [count, setCount] = useState(3);
  const [separator, setSeparator] = useState<MacSeparator>(':');
  const [upper, setUpper] = useState(true);
  const [generated, setGenerated] = useState<string[]>([]);

  const result = useMemo(() => analyzeMac(input), [input]);
  const info = result.ok ? result.value : null;

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <ShareButton getState={() => ({ i: input })} />
      </OptionBar>

      <IOTextArea
        label={t('tools.mac-address.input')}
        value={input}
        onChange={setInput}
        rows={2}
        placeholder={t('tools.mac-address.placeholder')}
        actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
      />

      {info && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {t('tools.mac-address.variants')}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <VariantRow label={t('tools.mac-address.formats')} value={info.normalized} />
            <VariantRow label=":" value={info.colon} />
            <VariantRow label="-" value={info.hyphen} />
            <VariantRow label="." value={info.dot} />
            <VariantRow label="bare" value={info.bare} />
            <VariantRow label="binary" value={info.binary} />
            <VariantRow label="EUI-64" value={info.eui64} />
            <VariantRow label="link-local" value={info.linkLocal} />
          </div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {t('tools.mac-address.flags')}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {FLAGS.map(([prop, labelKey]) => (
              <div
                key={labelKey}
                className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
              >
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {t(`tools.mac-address.${labelKey}`)}
                </span>
                <code className="break-all text-right font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {String(info[prop])}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          {t('tools.mac-address.generateTitle')}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.mac-address.count')}
            <input
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
          <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.mac-address.separator')}
            <select
              value={separator}
              onChange={(e) => setSeparator(e.target.value as MacSeparator)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value=":">:</option>
              <option value="-">-</option>
              <option value=".">.</option>
              <option value="none">none</option>
            </select>
          </label>
          <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} />
            {t('tools.mac-address.caseLabel')}
          </label>
          <button
            type="button"
            onClick={() => {
              const r = generateMacs(
                { count, separator, upper, locallyAdministered: true, multicast: false },
                Math.random,
              );
              if (r.ok) setGenerated(r.value);
            }}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t('tools.mac-address.generate')}
          </button>
        </div>
        {generated.length > 0 && (
          <ul className="mt-1 max-h-56 overflow-auto rounded-md bg-gray-50 p-2 font-mono text-sm dark:bg-gray-800">
            {generated.map((m, i) => (
              <li key={i} className="flex items-center justify-between gap-2 py-0.5">
                <span>{m}</span>
                <CopyButton text={m} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {!result.ok && input.trim() && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.mac-address', result)}
        </p>
      )}
    </div>
  );
}

function VariantRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700">
      <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
      <code className="break-all text-right font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
        {value}
      </code>
      <CopyButton text={value} />
    </div>
  );
}
