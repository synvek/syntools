import type { ToolResult } from '@/core/types';

export type TimeUnit = 'seconds' | 'milliseconds';

const SECONDS_MAX = 9_999_999_999;

const pad = (n: number, len = 2) => String(Math.abs(n)).padStart(len, '0');

export function detectUnit(input: string): ToolResult<TimeUnit> {
  const trimmed = input.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    return { ok: false, error: 'NOT_NUMERIC' };
  }
  const value = Math.abs(Number(trimmed));
  if (!Number.isFinite(value)) {
    return { ok: false, error: 'OUT_OF_RANGE' };
  }
  return { ok: true, value: value <= SECONDS_MAX ? 'seconds' : 'milliseconds' };
}

export function parseTimestamp(input: string): ToolResult<{ ms: number; unit: TimeUnit }> {
  const unitResult = detectUnit(input);
  if (!unitResult.ok) return unitResult;
  const ms = unitResult.value === 'seconds' ? Number(input.trim()) * 1000 : Number(input.trim());
  if (Math.abs(ms) > 8.64e15) {
    return { ok: false, error: 'TS_TOO_LARGE' };
  }
  return { ok: true, value: { ms, unit: unitResult.value } };
}

export interface FormattedTimestamp {
  local: string;
  utc: string;
  iso: string;
}

function formatParts(d: Date, utc: boolean): string {
  const y = utc ? d.getUTCFullYear() : d.getFullYear();
  const mo = (utc ? d.getUTCMonth() : d.getMonth()) + 1;
  const day = utc ? d.getUTCDate() : d.getDate();
  const h = utc ? d.getUTCHours() : d.getHours();
  const mi = utc ? d.getUTCMinutes() : d.getMinutes();
  const s = utc ? d.getUTCSeconds() : d.getSeconds();
  return `${pad(y, 4)}-${pad(mo)}-${pad(day)} ${pad(h)}:${pad(mi)}:${pad(s)}`;
}

export function formatTimestamp(ms: number): FormattedTimestamp {
  const d = new Date(ms);
  return {
    local: formatParts(d, false),
    utc: `${formatParts(d, true)} UTC`,
    iso: d.toISOString(),
  };
}

export type RelativeUnit = 'second' | 'minute' | 'hour' | 'day' | 'year';

export interface RelativeTime {
  count: number;
  unit: RelativeUnit;
  direction: 'ago' | 'later';
}

/** 相对当前时间的结构化描述，由 UI 层翻译 */
export function relativeParts(ms: number, now = Date.now()): RelativeTime {
  const diff = now - ms;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  const year = 365 * day;
  let count: number;
  let unit: RelativeUnit;
  if (abs < minute) {
    count = Math.round(abs / 1000);
    unit = 'second';
  } else if (abs < hour) {
    count = Math.round(abs / minute);
    unit = 'minute';
  } else if (abs < day) {
    count = Math.round(abs / hour);
    unit = 'hour';
  } else if (abs < year) {
    count = Math.round(abs / day);
    unit = 'day';
  } else {
    count = Number((abs / year).toFixed(1));
    unit = 'year';
  }
  return { count, unit, direction: diff >= 0 ? 'ago' : 'later' };
}

export function parseDate(input: string): ToolResult<{ seconds: number; milliseconds: number }> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'DATE_EMPTY' };
  const normalized = /^\d{4}-\d{2}-\d{2} /.test(trimmed) ? trimmed.replace(' ', 'T') : trimmed;
  const ms = new Date(normalized).getTime();
  if (Number.isNaN(ms)) {
    return { ok: false, error: 'DATE_INVALID' };
  }
  return { ok: true, value: { seconds: Math.floor(ms / 1000), milliseconds: ms } };
}
