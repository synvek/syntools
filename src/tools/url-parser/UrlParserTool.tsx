import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { consumeHandoff } from '@/core/lib/handoff';
import { parseUrl } from './core';

const PARTS = [
  'protocol',
  'host',
  'hostname',
  'port',
  'pathname',
  'search',
  'hash',
  'origin',
  'username',
  'password',
] as const;

export default function UrlParserTool() {
  const { t } = useTranslation();
  const init = useMemo(() => {
    const shared = readSharedState({ i: '' });
    const handoff = consumeHandoff('url-parser');
    return { i: handoff ?? shared.i };
  }, []);
  const [input, setInput] = useState(init.i);

  const result = useMemo(() => parseUrl(input), [input]);
  const info = result.ok ? result.value : null;

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <ShareButton getState={() => ({ i: input })} />
      </OptionBar>

      <IOTextArea
        label={t('tools.url-parser.input')}
        value={input}
        onChange={setInput}
        rows={2}
        placeholder={t('tools.url-parser.placeholder')}
        actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
      />

      {info && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {t('tools.url-parser.sections')}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {PARTS.map((key) => (
              <div
                key={key}
                className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
              >
                <span className="min-w-0 flex-1 text-sm text-gray-600 dark:text-gray-300">
                  {t(`tools.url-parser.${key}`)}
                </span>
                <code className="break-all text-right font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {String(info[key]) || '—'}
                </code>
                <CopyButton text={String(info[key])} />
              </div>
            ))}
          </div>

          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {t('tools.url-parser.params')}
            {info.params.length > 0 && ` (${info.params.length})`}
          </h2>
          {info.params.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">—</p>
          ) : (
            <ul className="rounded-md border border-gray-200 dark:border-gray-700">
              {info.params.map((p, i) => (
                <li
                  key={`${p.key}-${i}`}
                  className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 last:border-b-0 dark:border-gray-800"
                >
                  <span className="font-mono text-sm text-gray-600 dark:text-gray-300">
                    {p.key}
                  </span>
                  <code className="break-all text-right font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {p.value}
                  </code>
                  <CopyButton text={`${p.key}=${p.value}`} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!result.ok && input.trim() && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.url-parser', result)}
        </p>
      )}
    </div>
  );
}
