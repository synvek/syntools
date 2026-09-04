import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { CopyButton } from '@/core/components/CopyButton';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  WEB_COLOR_GROUPS,
  type WebColorGroup,
  contrastText,
  filterWebColors,
  toWebColorRows,
} from './core';

const ALL_ROWS = toWebColorRows();

/** Web / CSS 命名颜色对照表 */
export default function WebColorTableTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ q: '', g: 'all' }), []);
  const [query, setQuery] = useState(String(init.q || ''));
  const [group, setGroup] = useState<WebColorGroup | 'all'>(
    WEB_COLOR_GROUPS.includes(init.g as WebColorGroup) ? (init.g as WebColorGroup) : 'all',
  );

  const rows = useMemo(() => filterWebColors(ALL_ROWS, query, group), [query, group]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.webColorTable.search')}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('tools.webColorTable.searchPlaceholder')}
            className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.webColorTable.group')}
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value as WebColorGroup | 'all')}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="all">{t('tools.webColorTable.groups.all')}</option>
            {WEB_COLOR_GROUPS.map((g) => (
              <option key={g} value={g}>
                {t(`tools.webColorTable.groups.${g}`)}
              </option>
            ))}
          </select>
        </label>
        <ShareButton getState={() => ({ q: query, g: group })} />
      </OptionBar>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('tools.webColorTable.count', { n: rows.length, total: ALL_ROWS.length })}
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.webColorTable.empty')}</p>
      ) : (
        <div className="max-h-[40rem] overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                <th className="px-3 py-2">{t('tools.webColorTable.swatch')}</th>
                <th className="px-3 py-2">{t('tools.webColorTable.name')}</th>
                <th className="px-3 py-2">{t('tools.webColorTable.hex')}</th>
                <th className="px-3 py-2">{t('tools.webColorTable.rgb')}</th>
                <th className="px-3 py-2">{t('tools.webColorTable.group')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.name}-${row.hex}`}
                  className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/60"
                >
                  <td className="px-3 py-1.5">
                    <span
                      className="inline-block h-8 w-14 rounded border border-gray-200 dark:border-gray-600"
                      style={{ backgroundColor: row.hex }}
                      title={row.hex}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className="inline-flex rounded px-2 py-0.5 font-medium"
                      style={{ backgroundColor: row.hex, color: contrastText(row.hex) }}
                    >
                      {row.name}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 font-mono">{row.hex}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{row.rgb}</td>
                  <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">
                    {t(`tools.webColorTable.groups.${row.group}`)}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      <CopyButton text={row.name} label={t('tools.webColorTable.copyName')} />
                      <CopyButton text={row.hex} label={t('tools.webColorTable.copyHex')} />
                      <CopyButton text={row.rgb} label={t('tools.webColorTable.copyRgb')} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">{t('tools.webColorTable.hint')}</p>
    </div>
  );
}
