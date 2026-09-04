import type { ToolResult } from '@/core/types';

/**
 * Crontab 生成：由字段选项拼装标准 5 段 Cron（分 时 日 月 周）。
 */

export type CronFieldMode = 'every' | 'value' | 'range' | 'step' | 'list';

export interface CronFieldState {
  mode: CronFieldMode;
  value: number;
  from: number;
  to: number;
  step: number;
  list: string;
}

export type CronFieldKey = 'minute' | 'hour' | 'day' | 'month' | 'weekday';

export type CronGenError = 'INVALID_FIELD';

export const FIELD_BOUNDS: Record<CronFieldKey, { min: number; max: number }> = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  day: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  weekday: { min: 0, max: 6 },
};

export const DEFAULT_FIELD: CronFieldState = {
  mode: 'every',
  value: 0,
  from: 0,
  to: 0,
  step: 1,
  list: '',
};

export function defaultFields(): Record<CronFieldKey, CronFieldState> {
  return {
    minute: { ...DEFAULT_FIELD, value: 0, from: 0, to: 59 },
    hour: { ...DEFAULT_FIELD, value: 0, from: 0, to: 23 },
    day: { ...DEFAULT_FIELD, value: 1, from: 1, to: 31 },
    month: { ...DEFAULT_FIELD, value: 1, from: 1, to: 12 },
    weekday: { ...DEFAULT_FIELD, value: 0, from: 0, to: 6 },
  };
}

export function buildCronPart(key: CronFieldKey, state: CronFieldState): ToolResult<string> {
  const { min, max } = FIELD_BOUNDS[key];
  const clampOk = (n: number) => Number.isInteger(n) && n >= min && n <= max;

  switch (state.mode) {
    case 'every':
      return { ok: true, value: '*' };
    case 'value':
      if (!clampOk(state.value)) return { ok: false, error: 'INVALID_FIELD' };
      return { ok: true, value: String(state.value) };
    case 'range':
      if (!clampOk(state.from) || !clampOk(state.to) || state.from > state.to) {
        return { ok: false, error: 'INVALID_FIELD' };
      }
      return { ok: true, value: `${state.from}-${state.to}` };
    case 'step': {
      if (!Number.isInteger(state.step) || state.step < 1 || state.step > max) {
        return { ok: false, error: 'INVALID_FIELD' };
      }
      return { ok: true, value: `*/${state.step}` };
    }
    case 'list': {
      const parts = state.list
        .split(/[,\s]+/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length === 0) return { ok: false, error: 'INVALID_FIELD' };
      const nums = parts.map(Number);
      if (nums.some((n) => !clampOk(n))) return { ok: false, error: 'INVALID_FIELD' };
      return { ok: true, value: [...new Set(nums)].sort((a, b) => a - b).join(',') };
    }
    default:
      return { ok: false, error: 'INVALID_FIELD' };
  }
}

export function buildCronExpression(
  fields: Record<CronFieldKey, CronFieldState>,
): ToolResult<string> {
  const keys: CronFieldKey[] = ['minute', 'hour', 'day', 'month', 'weekday'];
  const parts: string[] = [];
  for (const key of keys) {
    const part = buildCronPart(key, fields[key]);
    if (!part.ok) return part;
    parts.push(part.value);
  }
  return { ok: true, value: parts.join(' ') };
}

/** 常用预设 */
export const CRON_PRESETS: { id: string; fields: Partial<Record<CronFieldKey, CronFieldState>> }[] =
  [
    {
      id: 'everyMinute',
      fields: {},
    },
    {
      id: 'hourly',
      fields: { minute: { ...DEFAULT_FIELD, mode: 'value', value: 0 } },
    },
    {
      id: 'daily',
      fields: {
        minute: { ...DEFAULT_FIELD, mode: 'value', value: 0 },
        hour: { ...DEFAULT_FIELD, mode: 'value', value: 0 },
      },
    },
    {
      id: 'weekly',
      fields: {
        minute: { ...DEFAULT_FIELD, mode: 'value', value: 0 },
        hour: { ...DEFAULT_FIELD, mode: 'value', value: 0 },
        weekday: { ...DEFAULT_FIELD, mode: 'value', value: 1 },
      },
    },
    {
      id: 'monthly',
      fields: {
        minute: { ...DEFAULT_FIELD, mode: 'value', value: 0 },
        hour: { ...DEFAULT_FIELD, mode: 'value', value: 0 },
        day: { ...DEFAULT_FIELD, mode: 'value', value: 1 },
      },
    },
  ];
