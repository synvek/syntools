import type { ToolResult } from '@/core/types';
import { lineSpans } from './lines';

/**
 * Find and replace pure logic (phase 3): match enumeration, whole-word / case / regex options,
 * and single / replace-all.
 *
 * Performance rules:
 * - Matches are capped at `MAX_MATCHES` and truncated beyond that (flagged by `truncated`), so a
 *   huge document cannot stall the main thread;
 * - Line / column numbers are derived incrementally during the scan (O(text + matches)) instead
 *   of calling `offsetToLineCol` per match, which would be O(n·m).
 */

export interface FindOptions {
  /** Match case */
  matchCase?: boolean;
  /** Whole word (boundaries judged by Unicode letters / digits / underscore, works for CJK too) */
  wholeWord?: boolean;
  /** Interpret the query as a regular expression */
  regex?: boolean;
}

export interface FindMatch {
  start: number;
  end: number;
  /** 1-based line number */
  line: number;
  /** 0-based column */
  col: number;
}

export interface FindResult {
  matches: FindMatch[];
  /** The match count hit the cap and was truncated */
  truncated: boolean;
}

export type FindErrorCode = 'REGEX_INVALID';

/** Match cap for a single search */
export const MAX_MATCHES = 5000;

const WORD_CHAR_RE = /[\p{L}\p{N}_]/u;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Query → global regex; the query is escaped when `regex` is off */
export function compileQuery(query: string, options: FindOptions = {}): ToolResult<RegExp> {
  const source = options.regex ? query : escapeRegExp(query);
  const flags = options.matchCase ? 'g' : 'gi';
  try {
    return { ok: true, value: new RegExp(source, flags) };
  } catch {
    return { ok: false, error: 'REGEX_INVALID' };
  }
}

/** Whether a boundary character is a word character (`\b` fails for CJK, so judge it here) */
function isWordChar(char: string | undefined): boolean {
  return Boolean(char) && WORD_CHAR_RE.test(char!);
}

/** Whole-word check: when a match edge is a word character, the neighbour must not be one */
function isWholeWord(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1] : undefined;
  const after = end < text.length ? text[end] : undefined;
  if (isWordChar(text[start]) && isWordChar(before)) return false;
  if (isWordChar(text[end - 1]) && isWordChar(after)) return false;
  return true;
}

/** Enumerate matches in the text (with line / column); an empty query yields an empty result */
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

    // Zero-length matches (e.g. `^` / `a*`) must advance manually or exec loops in place
    if (found[0].length === 0) pattern.lastIndex += 1;
    found = pattern.exec(text);
  }

  return { ok: true, value: { matches, truncated } };
}

/** Replacement text for one match (regex mode supports `$1` style syntax) */
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

/** Replace a single match */
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
 * Replace all: regex mode delegates to `String.replace` (keeping `$1` semantics); plain mode
 * splices by match range from the end backwards so offsets stay valid.
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
  // Skip replace-all when matches were truncated, so a partial result is never mistaken for a full one
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

/** Advance the match cursor (wrapping): stays 0 with no matches; backwards wraps from the end */
export function stepIndex(current: number, total: number, delta: 1 | -1): number {
  if (total <= 0) return 0;
  if (current < 0) return delta > 0 ? 0 : total - 1;
  return (current + delta + total) % total;
}
