import type { ToolResult } from '@/core/types';

export const COMMON_ZONES = [
  'UTC',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Paris',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Australia/Sydney',
];

/** 校验 IANA 时区名是否可用。 */
export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function partsInZone(date: Date, timeZone: string): Parts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, number> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = Number(part.value);
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour % 24,
    minute: map.minute,
    second: map.second,
  };
}

/** 返回该时刻在指定时区相对 UTC 的偏移（毫秒）。 */
export function getZoneOffsetMs(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/** 返回形如 `GMT+08:00` 的偏移文本。 */
export function zoneOffsetLabel(date: Date, timeZone: string): string {
  const ms = getZoneOffsetMs(date, timeZone);
  const sign = ms < 0 ? '-' : '+';
  const totalMin = Math.round(Math.abs(ms) / 60000);
  const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
  const mm = String(totalMin % 60).padStart(2, '0');
  return `GMT${sign}${hh}:${mm}`;
}

/** 把某时区的「墙上时间」转换为对应的 UTC 时刻。 */
export function wallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset1 = getZoneOffsetMs(new Date(naive), timeZone);
  let utc = new Date(naive - offset1);
  const offset2 = getZoneOffsetMs(utc, timeZone);
  if (offset2 !== offset1) utc = new Date(naive - offset2);
  return utc;
}

export interface ZoneConversion {
  zone: string;
  local: string;
  offset: string;
}

function formatLocal(date: Date, timeZone: string): string {
  const p = partsInZone(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

/** 将同一 UTC 时刻转换到多个时区。 */
export function convertZones(date: Date, zones: string[]): ToolResult<ZoneConversion[]> {
  if (!Number.isFinite(date.getTime())) return { ok: false, error: 'INVALID_DATE' };
  const out: ZoneConversion[] = [];
  for (const zone of zones) {
    if (!isValidZone(zone)) return { ok: false, error: 'INVALID_ZONE' };
    out.push({ zone, local: formatLocal(date, zone), offset: zoneOffsetLabel(date, zone) });
  }
  return { ok: true, value: out };
}
