import type { ToolResult } from '@/core/types';
import { lineSpans } from './lines';

/**
 * 查找与替换纯逻辑（阶段 3）：匹配枚举、整词 / 大小写 / 正则选项、单处与全部替换。
 *
 * 性能约定：
 * - 命中数量上限 `MAX_MATCHES`，超出即截断（`truncated` 标记），避免超长文本卡住主线程；
 * - 行列号在扫描过程中增量推算（O(文本 + 命中)），不做逐条 `offsetToLineCol` 的 O(n·m) 扫描。
 */

export interface FindOptions {
  /** 区分大小写 */
  matchCase?: boolean;
  /** 全词匹配（按 Unicode 字母 / 数字 / 下划线判定边界，中英文均适用） */
  wholeWord?: boolean;
  /** 按正则解释查找内容 */
  regex?: boolean;
}

export interface FindMatch {
  start: number;
  end: number;
  /** 1 起始行号 */
  line: number;
  /** 0 起始列号 */
  col: number;
}

export interface FindResult {
  matches: FindMatch[];
  /** 命中数达到上限被截断 */
  truncated: boolean;
}

export type FindErrorCode = 'REGEX_INVALID';

/** 单次查找的命中上限 */
export const MAX_MATCHES = 5000;

const WORD_CHAR_RE = /[\p{L}\p{N}_]/u;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 查找内容 → 全局正则；`regex` 关闭时对内容做转义 */
export function compileQuery(query: string, options: FindOptions = {}): ToolResult<RegExp> {
  const source = options.regex ? query : escapeRegExp(query);
  const flags = options.matchCase ? 'g' : 'gi';
  try {
    return { ok: true, value: new RegExp(source, flags) };
  } catch {
    return { ok: false, error: 'REGEX_INVALID' };
  }
}

/** 边界字符是否为词字符（`\b` 对 CJK 无效，这里自行判定） */
function isWordChar(char: string | undefined): boolean {
  return Boolean(char) && WORD_CHAR_RE.test(char!);
}

/** 全词匹配：命中首尾是词字符时，相邻字符不得同为词字符 */
function isWholeWord(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1] : undefined;
  const after = end < text.length ? text[end] : undefined;
  if (isWordChar(text[start]) && isWordChar(before)) return false;
  if (isWordChar(text[end - 1]) && isWordChar(after)) return false;
  return true;
}

/** 在文本中枚举命中（含行列号）；空查找内容返回空结果 */
export function findMatches(
  text: string,
  query: string,
  options: FindOptions = {},
): ToolResult<FindResult> {
  if (!query) return { ok: true, value: { matches: [], truncated: false } };

  const compiled = compileQuery(query, options);
  if (!compiled.ok) return { ok: false, error: compiled.error };
  const pattern = compiled.value;

  const spans = lineSpans(text);
  const matches: FindMatch[] = [];
  let spanIndex = 0;
  let truncated = false;
  let found = pattern.exec(text);

  while (found !== null) {
    const start = found.index;
    const end = start + found[0].length;
    const keep = !options.wholeWord || isWholeWord(text, start, end);

    if (keep) {
      while (spanIndex + 1 < spans.length && spans[spanIndex + 1]!.start <= start) spanIndex += 1;
      const span = spans[spanIndex]!;
      matches.push({ start, end, line: span.line, col: start - span.start });
      if (matches.length >= MAX_MATCHES) {
        truncated = true;
        break;
      }
    }

    // 零长度命中（如 `^` / `a*`）必须手动推进，否则 exec 会原地循环
    if (found[0].length === 0) pattern.lastIndex += 1;
    found = pattern.exec(text);
  }

  return { ok: true, value: { matches, truncated } };
}

/** 单个命中的替换文本（正则模式下支持 `$1` 等替换语法） */
function replacementFor(
  text: string,
  match: FindMatch,
  query: string,
  replacement: string,
  options: FindOptions,
): string {
  if (!options.regex) return replacement;
  const compiled = compileQuery(query, options);
  if (!compiled.ok) return replacement;
  return text.slice(match.start, match.end).replace(compiled.value, replacement);
}

/** 替换单处命中 */
export function replaceOne(
  text: string,
  match: FindMatch,
  query: string,
  replacement: string,
  options: FindOptions = {},
): string {
  const value = replacementFor(text, match, query, replacement, options);
  return text.slice(0, match.start) + value + text.slice(match.end);
}

/**
 * 全部替换：正则模式交给 `String.replace`（保留 `$1` 语义），
 * 普通模式按命中区间从后往前拼接，避免偏移错乱。
 */
export function replaceAll(
  text: string,
  query: string,
  replacement: string,
  options: FindOptions = {},
): ToolResult<string> {
  if (!query) return { ok: true, value: text };
  const found = findMatches(text, query, options);
  if (!found.ok) return { ok: false, error: found.error };
  const { matches, truncated } = found.value;
  if (matches.length === 0) return { ok: true, value: text };
  // 命中被截断时不做「全部替换」，避免只替换一部分造成误以为已全量替换
  if (truncated) return { ok: false, error: 'TOO_MANY_MATCHES' };

  if (options.regex && !options.wholeWord) {
    const compiled = compileQuery(query, options);
    if (!compiled.ok) return { ok: false, error: compiled.error };
    return { ok: true, value: text.replace(compiled.value, replacement) };
  }

  let next = text;
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const match = matches[i]!;
    next =
      next.slice(0, match.start) +
      replacementFor(text, match, query, replacement, options) +
      next.slice(match.end);
  }
  return { ok: true, value: next };
}

/** 命中游标推进（循环）：无命中维持 0，负方向从末尾回绕 */
export function stepIndex(current: number, total: number, delta: 1 | -1): number {
  if (total <= 0) return 0;
  if (current < 0) return delta > 0 ? 0 : total - 1;
  return (current + delta + total) % total;
}
