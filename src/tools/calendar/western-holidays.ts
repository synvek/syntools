/**
 * 英文区域常见假日（公历）。
 * en / en-US → 美国联邦假日为主；en-GB → 英国公共假日为主。
 */

export interface WesternHoliday {
  name: string;
  nameZh?: string;
}

function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number,
): number {
  // n: 1..5；weekday: 0=Sun..6=Sat
  const first = new Date(year, month - 1, 1);
  const firstWd = first.getDay();
  const day = 1 + ((weekday - firstWd + 7) % 7) + (n - 1) * 7;
  return day;
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): number {
  const last = new Date(year, month, 0).getDate();
  const d = new Date(year, month - 1, last);
  const delta = (d.getDay() - weekday + 7) % 7;
  return last - delta;
}

/** 匿名格里高利历复活节（西方教会） */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function shiftDate(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const d = new Date(year, month - 1, day + delta);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function key(y: number, m: number, d: number): string {
  return `${y}-${m}-${d}`;
}

function buildUsHolidays(year: number): Map<string, WesternHoliday> {
  const map = new Map<string, WesternHoliday>();
  const put = (m: number, d: number, name: string) => {
    map.set(key(year, m, d), { name });
  };
  put(1, 1, "New Year's Day");
  put(1, nthWeekdayOfMonth(year, 1, 1, 3), 'Martin Luther King Jr. Day');
  put(2, nthWeekdayOfMonth(year, 2, 1, 3), "Presidents' Day");
  put(5, lastWeekdayOfMonth(year, 5, 1), 'Memorial Day');
  put(6, 19, 'Juneteenth');
  put(7, 4, 'Independence Day');
  put(9, nthWeekdayOfMonth(year, 9, 1, 1), 'Labor Day');
  put(10, nthWeekdayOfMonth(year, 10, 1, 2), 'Columbus Day');
  put(11, 11, 'Veterans Day');
  put(11, nthWeekdayOfMonth(year, 11, 4, 4), 'Thanksgiving');
  put(12, 25, 'Christmas Day');
  return map;
}

function buildGbHolidays(year: number): Map<string, WesternHoliday> {
  const map = new Map<string, WesternHoliday>();
  const put = (m: number, d: number, name: string) => {
    map.set(key(year, m, d), { name });
  };
  put(1, 1, "New Year's Day");
  const easter = easterSunday(year);
  const goodFri = shiftDate(year, easter.month, easter.day, -2);
  const easterMon = shiftDate(year, easter.month, easter.day, 1);
  put(goodFri.month, goodFri.day, 'Good Friday');
  put(easterMon.month, easterMon.day, 'Easter Monday');
  put(5, nthWeekdayOfMonth(year, 5, 1, 1), 'Early May Bank Holiday');
  // Spring bank holiday: last Monday in May
  put(5, lastWeekdayOfMonth(year, 5, 1), 'Spring Bank Holiday');
  // Summer bank holiday: last Monday in August
  put(8, lastWeekdayOfMonth(year, 8, 1), 'Summer Bank Holiday');
  put(12, 25, 'Christmas Day');
  put(12, 26, 'Boxing Day');
  return map;
}

export type WesternHolidayRegion = 'us' | 'gb' | 'none';

export function resolveWesternRegion(lang: string): WesternHolidayRegion {
  const l = lang.toLowerCase();
  if (l.startsWith('zh')) return 'none';
  if (l === 'en-gb' || l.startsWith('en-gb')) return 'gb';
  if (l.startsWith('en')) return 'us';
  return 'none';
}

const cache = new Map<string, Map<string, WesternHoliday>>();

export function getWesternHoliday(
  year: number,
  month: number,
  day: number,
  region: WesternHolidayRegion,
): WesternHoliday | null {
  if (region === 'none') return null;
  const cacheKey = `${region}:${year}`;
  let map = cache.get(cacheKey);
  if (!map) {
    map = region === 'gb' ? buildGbHolidays(year) : buildUsHolidays(year);
    cache.set(cacheKey, map);
  }
  return map.get(key(year, month, day)) ?? null;
}
