import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { consumeHandoff } from '@/core/lib/handoff';
import { parseIpQuery, splitSubnets } from './core';

const FIELDS = [
  'network',
  'lastAddress',
  'firstHost',
  'lastHost',
  'netmask',
  'wildcard',
  'total',
  'usable',
  'decimal',
  'hex',
  'binary',
] as const;

export default function IpCalcTool() {
  const { t } = useTranslation();
  const init = useMemo(() => {
    const shared = readSharedState({ i: '' });
    const handoff = consumeHandoff('ip-calc');
    return { i: handoff ?? shared.i };
  }, []);
  const [input, setInput] = useState(init.i);
  const [target, setTarget] = useState('');

  const result = useMemo(() => parseIpQuery(input), [input]);
  const info = result.ok ? result.value : null;
  const subnets = useMemo(() => {
    if (!info || !target) return null;
    const n = Number(target);
    if (!Number.isInteger(n)) return null;
    const r = splitSubnets(input, n);
    return r.ok ? r.value : null;
  }, [info, target, input]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <ShareButton getState={() => ({ i: input })} />
      </OptionBar>

      <IOTextArea
        label={t('tools.ip-calc.input')}
        value={input}
        onChange={setInput}
        rows={2}
        placeholder={t('tools.ip-calc.placeholder')}
        actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
      />

      {info && (
        <div className="grid gap-2 sm:grid-cols-2">
          {FIELDS.map((key) => (
            <div
              key={key}
              className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
            >
              <span className="min-w-0 flex-1 text-sm text-gray-600 dark:text-gray-300">
                {t(`tools.ip-calc.fields.${key}`)}
              </span>
              <code className="break-all text-right font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                {String(info[key])}
              </code>
              <CopyButton text={String(info[key])} />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {t('tools.ip-calc.splitTitle')}
        </label>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value.replace(/[^\d]/g, ''))}
          inputMode="numeric"
          placeholder={t('tools.ip-calc.splitPlaceholder')}
          aria-label={t('tools.ip-calc.splitTitle')}
          className="w-40 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        {subnets && (
          <ul className="mt-1 max-h-56 overflow-auto rounded-md bg-gray-50 p-2 font-mono text-sm dark:bg-gray-800">
            {subnets.map((s) => (
              <li key={s} className="flex items-center justify-between gap-2 py-0.5">
                <span className="break-all">{s}</span>
                <CopyButton text={s} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {!result.ok && input.trim() && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.ip-calc', result)}
        </p>
      )}
    </div>
  );
}
