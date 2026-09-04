import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { consumeHandoff } from '@/core/lib/handoff';
import { parseUrl, rebuildUrl, type QueryPair } from './core';

const PARTS = [
  'protocol',
  'hostname',
  'port',
  'pathname',
  'hash',
  'origin',
] as const;

export default function UrlQueryTool() {
  const { t } = useTranslation();
  const init = useMemo(() => {
    const shared = readSharedState({ i: '' });
    const handoff = consumeHandoff('url-query');
    return { i: handoff ?? shared.i };
  }, []);
  const [input, setInput] = useState(init.i);
  const [query, setQuery] = useState<QueryPair[]>([]);
  const [rebuilt, setRebuilt] = useState('');

  const parsed = useMemo(() => parseUrl(input), [input]);

  useEffect(() => {
    if (parsed.ok) setQuery(parsed.value.query.map((p) => ({ ...p })));
    else setQuery([]);
  }, [parsed]);

  useEffect(() => {
    if (!input.trim()) {
      setRebuilt('');
      return;
    }
    const r = rebuildUrl(input, query);
    setRebuilt(r.ok ? r.value : '');
  }, [input, query]);

  const updatePair = (index: number, field: keyof QueryPair, value: string) => {
    setQuery((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <button
          type="button"
          onClick={() => setQuery((prev) => [...prev, { key: '', value: '' }])}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {t('tools.url-query.addParam')}
        </button>
        <ShareButton getState={() => ({ i: input })} />
      </OptionBar>

      <IOTextArea
        label={t('tools.url-query.input')}
        value={input}
        onChange={setInput}
        rows={3}
        placeholder={t('tools.url-query.placeholder')}
        actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
      />

      {parsed.ok && (
        <div className="grid gap-2 sm:grid-cols-2">
          {PARTS.map((key) => (
            <div
              key={key}
              className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
            >
              <span className="text-gray-500 dark:text-gray-400">
                {t(`tools.url-query.parts.${key}`)}
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-gray-900 dark:text-gray-100">
                {parsed.value[key] || '—'}
              </code>
            </div>
          ))}
        </div>
      )}

      {query.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left dark:bg-gray-900">
              <tr>
                <th className="px-3 py-2 font-medium">{t('tools.url-query.key')}</th>
                <th className="px-3 py-2 font-medium">{t('tools.url-query.value')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {query.map((pair, index) => (
                <tr key={index} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-2 py-1">
                    <input
                      value={pair.key}
                      onChange={(e) => updatePair(index, 'key', e.target.value)}
                      className="w-full rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      value={pair.value}
                      onChange={(e) => updatePair(index, 'value', e.target.value)}
                      className="w-full rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      onClick={() => setQuery((prev) => prev.filter((_, i) => i !== index))}
                      className="text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      {t('common.remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <IOTextArea
        label={t('tools.url-query.rebuilt')}
        value={rebuilt}
        readOnly
        rows={2}
        actions={<CopyButton text={rebuilt} disabled={!rebuilt} />}
      />

      {!parsed.ok && input.trim() && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.url-query', parsed)}
        </p>
      )}
    </div>
  );
}
