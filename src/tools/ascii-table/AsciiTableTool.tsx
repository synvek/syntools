import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { buildAsciiTable, filterAsciiTable } from './core';

/** ASCII 对照表 */
export default function AsciiTableTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ q: '' }), []);
  const [query, setQuery] = useState(init.q);
  const rows = useMemo(() => filterAsciiTable(buildAsciiTable(), query), [query]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.ascii.search')}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('tools.ascii.searchPlaceholder')}
            className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <ShareButton getState={() => ({ q: query })} />
      </OptionBar>

      <div className="max-h-[36rem] overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
              <th className="px-3 py-2">{t('tools.ascii.dec')}</th>
              <th className="px-3 py-2">{t('tools.ascii.hex')}</th>
              <th className="px-3 py-2">{t('tools.ascii.char')}</th>
              <th className="px-3 py-2">{t('tools.ascii.name')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const copyText = row.char || `\\x${row.hex}`;
              return (
                <tr
                  key={row.dec}
                  className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/60"
                >
                  <td className="px-3 py-1.5 font-mono">{row.dec}</td>
                  <td className="px-3 py-1.5 font-mono">0x{row.hex}</td>
                  <td className="px-3 py-1.5 font-mono text-base">
                    {row.char || '·'}
                  </td>
                  <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">{row.name}</td>
                  <td className="px-3 py-1.5">
                    <CopyButton text={copyText} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">{t('tools.ascii.hint')}</p>
    </div>
  );
}
