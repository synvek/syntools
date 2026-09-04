import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { analyzeCron, MAX_COUNT, MIN_COUNT, type CronFieldKey } from './core';

const clampCount = (n: number) => Math.min(Math.max(Math.floor(n) || 5, MIN_COUNT), MAX_COUNT);

/** Cron 表达式解析（Tasks T34）：文案全部走 i18n（T29 约定） */
export default function CronParserTool() {
  const { t } = useTranslation();
  // 从分享链接 ?s= 还原初始状态（T28）
  const init = useMemo(() => readSharedState({ e: '', c: 5 }), []);
  const [expression, setExpression] = useState(init.e);
  const [count, setCount] = useState(clampCount(init.c));

  const result = useMemo(() => analyzeCron(expression, count), [expression, count]);
  const analysis = result.ok ? result.value : null;

  /** 单值本地化：星期 → 星期名，月份 → 月份名，其余原样 */
  const valueName = (key: CronFieldKey, v: string): string => {
    if (key === 'week' && /^\d$/.test(v)) return t(`tools.cron.desc.days.${Number(v) % 7}`);
    if (key === 'month' && /^\d{1,2}$/.test(v)) {
      const m = Number(v);
      if (m >= 1 && m <= 12) return t(`tools.cron.desc.months.${m - 1}`);
    }
    return v;
  };

  /** 字段描述：* / *\/n / a-b / a-b/n / 列表，逗号分隔拼接 */
  const describeField = (key: CronFieldKey, raw: string): string => {
    if (raw === '*') return t(`tools.cron.desc.every.${key}`);
    const noun = t(`tools.cron.desc.nouns.${key}`);
    return raw
      .split(',')
      .map((part) => {
        const step = part.match(/^(\*|\d+-\d+)\/(\d+)$/);
        if (step) {
          if (step[1] === '*') {
            return t('tools.cron.desc.step', {
              n: step[2],
              unit: t(`tools.cron.desc.units.${key}`),
            });
          }
          const [a, b] = step[1].split('-');
          return t('tools.cron.desc.rangeStep', {
            noun,
            a: valueName(key, a),
            b: valueName(key, b),
            n: step[2],
          });
        }
        const range = part.match(/^(\d+)-(\d+)$/);
        if (range) {
          return t('tools.cron.desc.range', {
            noun,
            a: valueName(key, range[1]),
            b: valueName(key, range[2]),
          });
        }
        return t('tools.cron.desc.at', { noun, values: valueName(key, part) });
      })
      .join(t('tools.cron.desc.sep'));
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.cron.expression')}
          <input
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder={t('tools.cron.placeholder')}
            spellCheck={false}
            className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.cron.count')}
          <input
            type="number"
            min={MIN_COUNT}
            max={MAX_COUNT}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            onBlur={() => setCount(clampCount(count))}
            className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <ClearButton onClick={() => setExpression('')} disabled={!expression} />
        <ShareButton getState={() => ({ e: expression, c: count })} />
      </OptionBar>

      {expression.trim() && !result.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.cron.err.${result.error}`)}
        </p>
      )}

      {analysis && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t('tools.cron.normalized')}
            </span>
            <code className="rounded-md bg-gray-100 px-2 py-1 font-mono text-sm dark:bg-gray-800">
              {analysis.normalized}
            </code>
            <CopyButton text={analysis.normalized} />
          </div>

          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t('tools.cron.fieldsTitle')}</caption>
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
                <th className="py-1.5 pr-4 font-medium">{t('tools.cron.colField')}</th>
                <th className="py-1.5 pr-4 font-medium">{t('tools.cron.colValue')}</th>
                <th className="py-1.5 font-medium">{t('tools.cron.colMeaning')}</th>
              </tr>
            </thead>
            <tbody>
              {analysis.fields.map((field) => (
                <tr key={field.key} className="border-b border-gray-100 dark:border-gray-900">
                  <td className="py-1.5 pr-4 text-gray-500 dark:text-gray-400">
                    {t(`tools.cron.fieldNames.${field.key}`)}
                  </td>
                  <td className="py-1.5 pr-4 font-mono">{field.raw}</td>
                  <td className="py-1.5 text-gray-700 dark:text-gray-300">
                    {describeField(field.key, field.raw)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
              {t('tools.cron.nextTitle', { count: analysis.next.length })}
            </h2>
            <ol className="grid gap-1.5 sm:grid-cols-2">
              {analysis.next.map((date) => (
                <li
                  key={date.getTime()}
                  className="rounded-md bg-gray-100 px-3 py-1.5 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  {date.toLocaleString()}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}
