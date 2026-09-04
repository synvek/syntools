import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { consumeHandoff } from '@/core/lib/handoff';
import { parseCidr } from './core';

const FIELDS = [
  'network',
  'broadcast',
  'firstHost',
  'lastHost',
  'netmask',
  'wildcard',
  'prefix',
  'hostCount',
  'totalAddresses',
] as const;

export default function CidrCalcTool() {
  const { t } = useTranslation();
  const init = useMemo(() => {
    const shared = readSharedState({ i: '' });
    const handoff = consumeHandoff('cidr-calc');
    return { i: handoff ?? shared.i };
  }, []);
  const [input, setInput] = useState(init.i);

  const result = useMemo(() => parseCidr(input), [input]);
  const info = result.ok ? result.value : null;

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <ShareButton getState={() => ({ i: input })} />
      </OptionBar>

      <IOTextArea
        label={t('tools.cidr-calc.input')}
        value={input}
        onChange={setInput}
        rows={2}
        placeholder={t('tools.cidr-calc.placeholder')}
        actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
      />

      {info && (
        <div className="grid gap-2 sm:grid-cols-2">
          {FIELDS.map((key) => {
            const value = String(info[key]);
            return (
              <div
                key={key}
                className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
              >
                <span className="min-w-0 flex-1 text-sm text-gray-600 dark:text-gray-300">
                  {t(`tools.cidr-calc.fields.${key}`)}
                </span>
                <code className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {value}
                </code>
                <CopyButton text={value} />
              </div>
            );
          })}
        </div>
      )}

      {!result.ok && input.trim() && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.cidr-calc', result)}
        </p>
      )}
    </div>
  );
}
