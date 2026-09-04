import { CronExpressionParser } from 'cron-parser';
import type { ToolResult } from '@/core/types';

/**
 * Cron 表达式解析（Tasks T34）：基于 cron-parser 校验与推算下次执行时间。
 * 支持 5 字段（分时日月周）与 6 字段（含秒），及 @daily 等宏；时区取浏览器本地。
 * 错误码与文案解耦：core 返回语言无关错误码，UI 层经 i18n 翻译（T29 约定）。
 */

export type CronErrorCode = 'EMPTY' | 'INVALID';

export type CronFieldKey = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'week';

export interface CronField {
  key: CronFieldKey;
  /** 归一化后的段值，如 *\/5、1-5 */
  raw: string;
}

export interface CronAnalysis {
  /** 归一化表达式（@daily → 0 0 * * *） */
  normalized: string;
  fields: CronField[];
  /** 未来 count 次执行时间（本地时区） */
  next: Date[];
}

export const MIN_COUNT = 1;
export const MAX_COUNT = 20;

const KEYS_WITH_SECOND: CronFieldKey[] = ['second', 'minute', 'hour', 'day', 'month', 'week'];
const KEYS_STANDARD: CronFieldKey[] = ['minute', 'hour', 'day', 'month', 'week'];

/** 解析并推算未来执行时间；错误时 error 为 CronErrorCode */
export function analyzeCron(
  expression: string,
  count = 5,
  now: Date = new Date(),
): ToolResult<CronAnalysis> {
  const input = expression.trim();
  if (!input) return { ok: false, error: 'EMPTY' };
  // 仅接受 5/6 字段或 @宏：cron-parser 对更少的字段会默认补全，这里显式拒绝
  const tokens = input.split(/\s+/);
  if (tokens.length !== 5 && tokens.length !== 6 && !input.startsWith('@')) {
    return { ok: false, error: 'INVALID' };
  }
  const limit = Math.min(Math.max(Math.floor(count) || MIN_COUNT, MIN_COUNT), MAX_COUNT);

  try {
    const expr = CronExpressionParser.parse(input, { currentDate: now });
    // 6 字段输入（含秒）时保留秒段输出
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
