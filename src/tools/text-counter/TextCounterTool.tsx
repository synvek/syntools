import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { CopyButton } from '@/core/components/CopyButton';
import { readSharedState } from '@/core/lib/share';
import { countTextStats, type TextCountStats } from './core';

const STAT_KEYS: (keyof TextCountStats)[] = [
  'chars',
  'charsNoSpace',
  'words',
  'cjk',
  'lines',
  'paragraphs',
  'spaces',
  'bytes',
  'utf16Length',
];

/** 在线字数统计 */
export default function TextCounterTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ i: '' }), []);
  const [input, setInput] = useState(init.i);

  const result = useMemo(() => countTextStats(input), [input]);
  const stats = result.ok ? result.value : null;

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <ShareButton getState={() => ({ i: input })} />
      </OptionBar>

      <IOTextArea
        label={t('tools.textCounter.input')}
        value={input}
        onChange={setInput}
        placeholder={t('tools.textCounter.placeholder')}
        actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
      />

      {stats && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STAT_KEYS.map((key) => {
            const value = String(stats[key]);
            return (
              <div
                key={key}
                className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
              >
                <span className="min-w-0 flex-1 text-sm text-gray-600 dark:text-gray-300">
                  {t(`tools.textCounter.stats.${key}`)}
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

      {!result.ok && (
        <p className="text-sm text-gray-400 dark:text-gray-500">{t('tools.textCounter.emptyHint')}</p>
      )}
    </div>
  );
}
