import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  buildMonthGrid,
  dayCultureKey,
  formatDateParts,
  getDaysCultureInfo,
  isSameDay,
  resolveCultureProfile,
  shiftMonth,
  todayParts,
  weekdayOrder,
  type DayCultureInfo,
  type RestMark,
  type WeekStart,
} from './core';

function restBadgeClass(rest: RestMark): string {
  if (rest === 'off') return 'bg-red-500 text-white';
  if (rest === 'work') return 'bg-slate-600 text-white';
  return '';
}

function cellTone(info: DayCultureInfo | undefined, inMonth: boolean): string {
  if (!inMonth) return 'text-gray-300 dark:text-gray-600';
  if (info?.rest === 'off' || (info?.festivals.length ?? 0) > 0 || info?.solarTerm) {
    return 'text-red-600 dark:text-red-400';
  }
  if (info?.rest === 'weekend') return 'text-red-500/90 dark:text-red-400/90';
  return 'text-gray-800 dark:text-gray-100';
}

/** 在线日历 */
export default function CalendarTool() {
  const { t, i18n } = useTranslation();
  const today = useMemo(() => todayParts(), []);
  const init = useMemo(
    () =>
      readSharedState({
        y: today.year,
        m: today.month,
        d: today.day,
        w: 1,
      }),
    [today.day, today.month, today.year],
  );

  const [year, setYear] = useState(Number(init.y) || today.year);
  const [month, setMonth] = useState(Number(init.m) || today.month);
  const [selected, setSelected] = useState({
    year: Number(init.y) || today.year,
    month: Number(init.m) || today.month,
    day: Number(init.d) || today.day,
  });
  const [weekStartsOn, setWeekStartsOn] = useState<WeekStart>(init.w === 0 ? 0 : 1);

  const profile = resolveCultureProfile(i18n.language);
  const cells = useMemo(
    () => buildMonthGrid(year, month, weekStartsOn),
    [year, month, weekStartsOn],
  );
  const cultureMap = useMemo(
    () => getDaysCultureInfo(cells, i18n.language),
    [cells, i18n.language],
  );
  const weekdays = useMemo(() => weekdayOrder(weekStartsOn), [weekStartsOn]);
  const formats = useMemo(
    () => formatDateParts(selected.year, selected.month, selected.day, i18n.language),
    [selected, i18n.language],
  );
  const selectedInfo = cultureMap.get(
    dayCultureKey(selected.year, selected.month, selected.day),
  );

  const go = (delta: number) => {
    const next = shiftMonth(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
  };

  const goToday = () => {
    setYear(today.year);
    setMonth(today.month);
    setSelected(today);
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.calendar.weekStart')}
          <select
            value={weekStartsOn}
            onChange={(e) => setWeekStartsOn(Number(e.target.value) === 0 ? 0 : 1)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value={1}>{t('tools.calendar.weekStarts.mon')}</option>
            <option value={0}>{t('tools.calendar.weekStarts.sun')}</option>
          </select>
        </label>
        <button
          type="button"
          onClick={goToday}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t('tools.calendar.today')}
        </button>
        <ShareButton
          getState={() => ({
            y: selected.year,
            m: selected.month,
            d: selected.day,
            w: weekStartsOn,
          })}
        />
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1 rounded-md border border-gray-200 p-3 dark:border-gray-700">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={t('tools.calendar.prev')}
              className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              ‹
            </button>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
              {t('tools.calendar.title', { year, month })}
            </h2>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={t('tools.calendar.next')}
              className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
            {weekdays.map((wd) => (
              <div key={wd} className="py-1">
                {t(`tools.calendar.weekdays.${wd}`)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const isToday = isSameDay(cell, today);
              const isSelected = isSameDay(cell, selected);
              const info = cultureMap.get(dayCultureKey(cell.year, cell.month, cell.day));
              const showOfficialBadge = info?.rest === 'off' || info?.rest === 'work';
              return (
                <button
                  key={`${cell.year}-${cell.month}-${cell.day}-${cell.inMonth}`}
                  type="button"
                  onClick={() => {
                    setSelected({ year: cell.year, month: cell.month, day: cell.day });
                    if (!cell.inMonth) {
                      setYear(cell.year);
                      setMonth(cell.month);
                    }
                  }}
                  className={[
                    'relative flex min-h-[4.25rem] flex-col items-center justify-start rounded-md px-0.5 py-1 text-sm transition-colors',
                    isSelected
                      ? 'bg-blue-600 text-white hover:bg-blue-600'
                      : isToday
                        ? 'bg-blue-50 font-semibold hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800',
                    isSelected ? 'text-white' : cellTone(info, cell.inMonth),
                  ].join(' ')}
                >
                  {showOfficialBadge && profile === 'zh' && (
                    <span
                      className={[
                        'absolute right-0.5 top-0.5 rounded px-0.5 text-[9px] leading-none',
                        isSelected ? 'bg-white/25 text-white' : restBadgeClass(info.rest),
                      ].join(' ')}
                    >
                      {info.rest === 'work'
                        ? t('tools.calendar.rest.work')
                        : t('tools.calendar.rest.off')}
                    </span>
                  )}
                  <span className="text-sm leading-none">{cell.day}</span>
                  {info?.subline ? (
                    <span
                      className={[
                        'mt-1 max-w-full truncate text-[10px] leading-tight',
                        isSelected
                          ? 'text-blue-100'
                          : cell.inMonth
                            ? 'text-current opacity-80'
                            : 'text-gray-300 dark:text-gray-600',
                      ].join(' ')}
                    >
                      {info.subline}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {profile === 'zh' && (
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              {t('tools.calendar.legendZh')}
            </p>
          )}
          {profile === 'en' && (
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              {t('tools.calendar.legendEn')}
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-80">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('tools.calendar.selected')}
          </p>
          {(
            [
              ['iso', formats.iso],
              ['slash', formats.slash],
              ['locale', formats.locale],
            ] as const
          ).map(([key, value]) => (
            <div
              key={key}
              className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
            >
              <span className="w-16 shrink-0 text-xs text-gray-500 dark:text-gray-400">
                {t(`tools.calendar.formats.${key}`)}
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-sm text-gray-800 dark:text-gray-100">
                {value}
              </code>
              <CopyButton text={value} />
            </div>
          ))}

          {selectedInfo && (
            <div className="mt-1 flex flex-col gap-2 rounded-md border border-gray-200 p-3 text-sm dark:border-gray-700">
              {selectedInfo.lunarFull && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('tools.calendar.lunar')}
                  </p>
                  <p className="text-gray-800 dark:text-gray-100">{selectedInfo.lunarFull}</p>
                  {selectedInfo.ganZhiDay && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('tools.calendar.ganZhi', { day: selectedInfo.ganZhiDay })}
                    </p>
                  )}
                </div>
              )}

              {(selectedInfo.festivals.length > 0 || selectedInfo.solarTerm) && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('tools.calendar.festivals')}
                  </p>
                  <p className="text-red-600 dark:text-red-400">
                    {[...selectedInfo.festivals, selectedInfo.solarTerm]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              )}

              {selectedInfo.rest && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('tools.calendar.restLabel')}
                  </p>
                  <p className="text-gray-800 dark:text-gray-100">
                    {t(`tools.calendar.rest.${selectedInfo.rest}`)}
                    {selectedInfo.holidayName ? ` · ${selectedInfo.holidayName}` : ''}
                  </p>
                </div>
              )}

              {profile === 'zh' && selectedInfo.yi.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {t('tools.calendar.yi')}
                  </p>
                  <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                    {selectedInfo.yi.join('、')}
                  </p>
                </div>
              )}
              {profile === 'zh' && selectedInfo.ji.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-rose-700 dark:text-rose-400">
                    {t('tools.calendar.ji')}
                  </p>
                  <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                    {selectedInfo.ji.join('、')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
