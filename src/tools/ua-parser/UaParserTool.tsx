import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { parseUserAgent } from './core';

const FIELDS = ['browser', 'engine', 'os', 'device', 'cpu'] as const;

/** User-Agent 解析 */
export default function UaParserTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () =>
      readSharedState({
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      }),
    [],
  );
  const [ua, setUa] = useState(String(init.ua || ''));

  const result = useMemo(() => parseUserAgent(ua), [ua]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <button
          type="button"
          onClick={() => setUa(navigator.userAgent)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t('tools.uaParser.useCurrent')}
        </button>
        <ShareButton getState={() => ({ ua })} />
      </OptionBar>

      <IOTextArea
        label={t('tools.uaParser.input')}
        value={ua}
        onChange={setUa}
        placeholder={t('tools.uaParser.placeholder')}
        actions={<ClearButton onClick={() => setUa('')} disabled={!ua} />}
      />

      {!result.ok && ua.trim() && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.uaParser.err.${result.error}`)}
        </p>
      )}

      {result.ok && (
        <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900/60 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2">{t('tools.uaParser.field')}</th>
                <th className="px-3 py-2">{t('tools.uaParser.name')}</th>
                <th className="px-3 py-2">{t('tools.uaParser.version')}</th>
                <th className="px-3 py-2">{t('tools.uaParser.extra')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {FIELDS.map((key) => {
                const row = result.value[key];
                const line = [row.name, row.version, row.extra].filter(Boolean).join(' ');
                return (
                  <tr
                    key={key}
                    className="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200">
                      {t(`tools.uaParser.fields.${key}`)}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-800 dark:text-gray-100">
                      {row.name}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-800 dark:text-gray-100">
                      {row.version}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-500 dark:text-gray-400">
                      {row.extra || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <CopyButton text={line} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
