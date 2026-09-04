import type { ToolResult } from '@/core/types';

export interface RegexMatch {
  value: string;
  index: number;
  groups: (string | undefined)[];
  named: Record<string, string | undefined>;
}

export const MAX_MATCHES = 1000;
export const MAX_TEXT_LENGTH = 100_000;

export function compileRegex(pattern: string, flags: string): ToolResult<RegExp> {
  if (!pattern) {
    return { ok: false, error: 'EMPTY' };
  }
  try {
    return { ok: true, value: new RegExp(pattern, flags) };
  } catch (e) {
    return { ok: false, error: 'COMPILE', params: { message: (e as Error).message } };
  }
}

export function findMatches(
  regex: RegExp,
  text: string,
): ToolResult<{ matches: RegexMatch[]; truncated: boolean }> {
  if (text.length > MAX_TEXT_LENGTH) {
    return {
      ok: false,
      error: 'TEXT_TOO_LONG',
      params: { limit: MAX_TEXT_LENGTH / 1000 },
    };
  }
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const re = new RegExp(regex.source, flags);
  const matches: RegexMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push({
      value: m[0],
      index: m.index,
      groups: m.slice(1),
      named: { ...(m.groups ?? {}) },
    });
    if (m[0] === '') re.lastIndex++;
    if (matches.length >= MAX_MATCHES) {
      return { ok: true, value: { matches, truncated: true } };
    }
  }
  return { ok: true, value: { matches, truncated: false } };
}

/** 正则替换（支持 $1 / $& 等标准替换串） */
export function replaceRegex(
  regex: RegExp,
  text: string,
  replacement: string,
  all = true,
): ToolResult<string> {
  if (text.length > MAX_TEXT_LENGTH) {
    return {
      ok: false,
      error: 'TEXT_TOO_LONG',
      params: { limit: MAX_TEXT_LENGTH / 1000 },
    };
  }
  try {
    const flags = all
      ? regex.flags.includes('g')
        ? regex.flags
        : `${regex.flags}g`
      : regex.flags.replace(/g/g, '');
    const re = new RegExp(regex.source, flags);
    return { ok: true, value: text.replace(re, replacement) };
  } catch (e) {
    return { ok: false, error: 'COMPILE', params: { message: (e as Error).message } };
  }
}

export interface CheatSheetItem {
  id: string;
  token: string;
}

export const CHEAT_SHEET: CheatSheetItem[] = [
  { id: 'dot', token: '.' },
  { id: 'digit', token: '\\d' },
  { id: 'word', token: '\\w' },
  { id: 'space', token: '\\s' },
  { id: 'start', token: '^' },
  { id: 'end', token: '$' },
  { id: 'star', token: '*' },
  { id: 'plus', token: '+' },
  { id: 'question', token: '?' },
  { id: 'or', token: '|' },
  { id: 'group', token: '(...)' },
  { id: 'class', token: '[abc]' },
  { id: 'range', token: '[a-z]' },
  { id: 'not', token: '[^abc]' },
];

export interface PresetPattern {
  id: string;
  pattern: string;
  flags: string;
}

export const PRESET_PATTERNS: PresetPattern[] = [
  { id: 'email', pattern: '^[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+$', flags: '' },
  { id: 'phoneCn', pattern: '^1[3-9]\\d{9}$', flags: '' },
  { id: 'idCard', pattern: '^\\d{17}[\\dXx]$', flags: '' },
  { id: 'url', pattern: 'https?://[^\\s]+', flags: 'g' },
  {
    id: 'ipv4',
    pattern: '\\b((25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b',
    flags: 'g',
  },
  {
    id: 'date',
    pattern: '\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])',
    flags: 'g',
  },
];
