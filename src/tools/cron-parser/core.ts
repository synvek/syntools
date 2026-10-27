import { CronExpressionParser } from 'cron-parser';
import type { ToolResult } from '@/core/types';

/**
 * Cron expression parsing (Tasks T34): validate and project upcoming runs via cron-parser.
 * Supports 5 fields (minute hour day month weekday), 6 fields (with seconds), and macros such as @daily; the timezone is the browser's local one.
 * Error codes are decoupled from copy: core returns language-neutral codes that the UI translates via i18n (T29 convention).
 */

export type CronErrorCode = 'EMPTY' | 'INVALID';

export type CronFieldKey = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'week';

export interface CronField {
  key: CronFieldKey;
  /** Normalized field values, e.g. *\/5, 1-5 */
  raw: string;
}

export interface CronAnalysis {
  /** Normalized expression (@daily → 0 0 * * *) */
  normalized: string;
  fields: CronField[];
  /** The next count run times (local timezone) */
  next: Date[];
}

export const MIN_COUNT = 1;
export const MAX_COUNT = 20;

const KEYS_WITH_SECOND: CronFieldKey[] = ['second', 'minute', 'hour', 'day', 'month', 'week'];
const KEYS_STANDARD: CronFieldKey[] = ['minute', 'hour', 'day', 'month', 'week'];

/** Parse and project upcoming run times; on failure, error is a CronErrorCode */
export function analyzeCron(
  expression: string,
  count = 5,
  now: Date = new Date(),
): ToolResult<CronAnalysis> {
  const input = expression.trim();
  if (!input) return { ok: false, error: 'EMPTY' };
  // Accept only 5/6 fields or @macros: cron-parser silently pads fewer fields, so reject them explicitly
  const tokens = input.split(/\s+/);
  if (tokens.length !== 5 && tokens.length !== 6 && !input.startsWith('@')) {
    return { ok: false, error: 'INVALID' };
  }
  const limit = Math.min(Math.max(Math.floor(count) || MIN_COUNT, MIN_COUNT), MAX_COUNT);

  try {
    const expr = CronExpressionParser.parse(input, { currentDate: now });
    // Keep the seconds field in the output when the input has 6 fields
    const hasSecond = input.split(/\s+/).length === 6;
    const normalized = expr.stringify(hasSecond);
    const keys = hasSecond ? KEYS_WITH_SECOND : KEYS_STANDARD;
    const parts = normalized.split(/\s+/);

    const fields: CronField[] = keys.map((key, i) => ({ key, raw: parts[i] ?? '*' }));
    const next = expr.take(limit).map((d) => d.toDate());

    return { ok: true, value: { normalized, fields, next } };
  } catch {
    return { ok: false, error: 'INVALID' };
  }
}
