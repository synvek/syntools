import { HolidayUtil, I18n, Solar } from 'lunar-javascript';
import {
  getWesternHoliday,
  resolveWesternRegion,
  type WesternHolidayRegion,
} from './western-holidays';

/**
 * 日历文化增强：中文阴历/节气/法定休班/宜忌；英文等本地假日与周末标识。
 */

export type RestMark = 'off' | 'work' | 'weekend' | null;

export interface DayCultureInfo {
  /** 月格副文案（阴历日 / 节日 / 节气 择一） */
  subline: string;
  /** 阴历简写，如 初一→正月、廿九 */
  lunarText: string | null;
  /** 阴历完整描述 */
  lunarFull: string | null;
  festivals: string[];
  solarTerm: string | null;
  rest: RestMark;
  /** 法定假日名（休/班关联） */
  holidayName: string | null;
  yi: string[];
  ji: string[];
  ganZhiDay: string | null;
  shengXiao: string | null;
}

export type CalendarCultureProfile = 'zh' | 'en' | 'generic';

export function resolveCultureProfile(lang: string): CalendarCultureProfile {
  const l = lang.toLowerCase();
  if (l.startsWith('zh')) return 'zh';
  if (l.startsWith('en')) return 'en';
  return 'generic';
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${month}-${day}`;
}

function applyLunarLanguage(profile: CalendarCultureProfile): void {
  // lunar-javascript：chs / en（以及 cht 等）
  I18n.setLanguage(profile === 'zh' ? 'chs' : 'en');
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const s = raw.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function truncateLabel(text: string, max = 4): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function weekendRest(year: number, month: number, day: number): boolean {
  const wd = new Date(year, month - 1, day).getDay();
  return wd === 0 || wd === 6;
}

function buildZhDay(year: number, month: number, day: number): DayCultureInfo {
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();
  const dayCn = lunar.getDayInChinese();
  const monthCn = lunar.getMonthInChinese();
  const lunarText = dayCn === '初一' ? `${monthCn}月` : dayCn;
  const lunarFull = `${lunar.getYearInGanZhi()}${lunar.getYearShengXiao()}年 ${monthCn}月${dayCn}`;
  const solarTerm = lunar.getJieQi() || null;
  const festivalOnly = uniqueStrings([
    ...solar.getFestivals(),
    ...solar.getOtherFestivals(),
    ...lunar.getFestivals(),
    ...lunar.getOtherFestivals(),
  ]);

  const holiday = HolidayUtil.getHoliday(year, month, day);
  let rest: RestMark = null;
  let holidayName: string | null = null;
  if (holiday) {
    holidayName = holiday.getName();
    rest = holiday.isWork() ? 'work' : 'off';
  } else if (weekendRest(year, month, day)) {
    rest = 'weekend';
  }

  const subSource = festivalOnly[0] || solarTerm || lunarText;
  return {
    subline: truncateLabel(subSource, 5),
    lunarText,
    lunarFull,
    festivals: festivalOnly,
    solarTerm,
    rest,
    holidayName,
    yi: lunar.getDayYi(),
    ji: lunar.getDayJi(),
    ganZhiDay: lunar.getDayInGanZhi(),
    shengXiao: lunar.getYearShengXiao(),
  };
}

function buildEnDay(
  year: number,
  month: number,
  day: number,
  region: WesternHolidayRegion,
): DayCultureInfo {
  const solar = Solar.fromYmd(year, month, day);
  const libFestivals = uniqueStrings([
    ...solar.getFestivals(),
    ...solar.getOtherFestivals(),
  ]);
  const western = getWesternHoliday(year, month, day, region);
  const festivals = uniqueStrings([
    ...libFestivals,
    ...(western ? [western.name] : []),
  ]);

  let rest: RestMark = null;
  if (festivals.length > 0 && !weekendRest(year, month, day)) {
    // 公共假日：工作日遇上则标 off
    rest = 'off';
  } else if (weekendRest(year, month, day)) {
    rest = 'weekend';
  }
  // 若假日落在周末，仍标 weekend，但保留节日名

  const subSource = festivals[0] || null;
  return {
    subline: subSource ? truncateLabel(subSource, 10) : '',
    lunarText: null,
    lunarFull: null,
    festivals,
    solarTerm: null,
    rest,
    holidayName: festivals[0] ?? null,
    yi: [],
    ji: [],
    ganZhiDay: null,
    shengXiao: null,
  };
}

function buildGenericDay(year: number, month: number, day: number): DayCultureInfo {
  return {
    subline: '',
    lunarText: null,
    lunarFull: null,
    festivals: [],
    solarTerm: null,
    rest: weekendRest(year, month, day) ? 'weekend' : null,
    holidayName: null,
    yi: [],
    ji: [],
    ganZhiDay: null,
    shengXiao: null,
  };
}

export function getDayCultureInfo(
  year: number,
  month: number,
  day: number,
  lang: string,
): DayCultureInfo {
  const profile = resolveCultureProfile(lang);
  applyLunarLanguage(profile);
  if (profile === 'zh') return buildZhDay(year, month, day);
  if (profile === 'en') {
    return buildEnDay(year, month, day, resolveWesternRegion(lang));
  }
  return buildGenericDay(year, month, day);
}

/** 批量查询（同语言一次设 i18n，减少重复切换） */
export function getDaysCultureInfo(
  days: Array<{ year: number; month: number; day: number }>,
  lang: string,
): Map<string, DayCultureInfo> {
  const profile = resolveCultureProfile(lang);
  applyLunarLanguage(profile);
  const region = resolveWesternRegion(lang);
  const map = new Map<string, DayCultureInfo>();
  for (const d of days) {
    const k = dateKey(d.year, d.month, d.day);
    if (map.has(k)) continue;
    if (profile === 'zh') map.set(k, buildZhDay(d.year, d.month, d.day));
    else if (profile === 'en') map.set(k, buildEnDay(d.year, d.month, d.day, region));
    else map.set(k, buildGenericDay(d.year, d.month, d.day));
  }
  return map;
}

export function dayCultureKey(year: number, month: number, day: number): string {
  return dateKey(year, month, day);
}
