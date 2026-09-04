/**
 * 在线日历：月视图网格与日期格式化（纯函数）。
 */

export type WeekStart = 0 | 1; // 0=周日, 1=周一

export interface CalendarCell {
  year: number;
  month: number; // 1-12
  day: number;
  inMonth: boolean;
}

export interface DateFormats {
  iso: string;
  locale: string;
  slash: string;
  weekDay: number; // 0-6 Sun-Sat
}

/** 构造某月日历网格（含上下月填充，固定 6 行 × 7 列） */
export function buildMonthGrid(
  year: number,
  month: number,
  weekStartsOn: WeekStart = 1,
): CalendarCell[] {
  const first = new Date(year, month - 1, 1);
  const firstWeekday = first.getDay(); // 0 Sun
  const offset = (firstWeekday - weekStartsOn + 7) % 7;
  const start = new Date(year, month - 1, 1 - offset);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      inMonth: d.getMonth() + 1 === month && d.getFullYear() === year,
    });
  }
  return cells;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function isSameDay(
  a: { year: number; month: number; day: number },
  b: { year: number; month: number; day: number },
): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function todayParts(now = new Date()): { year: number; month: number; day: number } {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export function formatDateParts(
  year: number,
  month: number,
  day: number,
  locale = 'zh-CN',
): DateFormats {
  const d = new Date(year, month - 1, day);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    iso: `${year}-${pad(month)}-${pad(day)}`,
    slash: `${year}/${pad(month)}/${pad(day)}`,
    locale: d.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }),
    weekDay: d.getDay(),
  };
}

/** 周标题顺序：按 weekStartsOn 旋转 [日..六] 的索引 */
export function weekdayOrder(weekStartsOn: WeekStart): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
}

export {
  dayCultureKey,
  getDayCultureInfo,
  getDaysCultureInfo,
  resolveCultureProfile,
  type CalendarCultureProfile,
  type DayCultureInfo,
  type RestMark,
} from './culture';

export {
  easterSunday,
  getWesternHoliday,
  resolveWesternRegion,
} from './western-holidays';
