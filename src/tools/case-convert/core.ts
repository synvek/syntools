import type { ToolResult } from '@/core/types';

/**
 * 字母大小写 / 命名风格转换。
 */

export type CaseMode =
  | 'upper'
  | 'lower'
  | 'title'
  | 'sentence'
  | 'swap'
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'kebab'
  | 'constant';

export type CaseError = 'EMPTY';

export const CASE_MODES: CaseMode[] = [
  'upper',
  'lower',
  'title',
  'sentence',
  'swap',
  'camel',
  'pascal',
  'snake',
  'kebab',
  'constant',
];

/** 拆成单词：空白 / 标点 / 驼峰边界 */
export function splitWords(input: string): string[] {
  const spaced = input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ');
  return spaced
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function capitalize(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function convertCase(input: string, mode: CaseMode): ToolResult<string> {
  if (!input) return { ok: false, error: 'EMPTY' };

  switch (mode) {
    case 'upper':
      return { ok: true, value: input.toUpperCase() };
    case 'lower':
      return { ok: true, value: input.toLowerCase() };
    case 'swap': {
      let out = '';
      for (const ch of input) {
        const up = ch.toUpperCase();
        const lo = ch.toLowerCase();
        out += ch === up && ch !== lo ? lo : ch === lo && ch !== up ? up : ch;
      }
      return { ok: true, value: out };
    }
    case 'title':
      return {
        ok: true,
        value: input.replace(/\p{L}[\p{L}\p{M}\p{N}']*/gu, (w) => capitalize(w)),
      };
    case 'sentence': {
      const lower = input.toLowerCase();
      return {
        ok: true,
        value: lower.replace(/(^\s*\p{L})|([.!?。！？]\s*\p{L})/gu, (m) => m.toUpperCase()),
      };
    }
    case 'camel':
    case 'pascal':
    case 'snake':
    case 'kebab':
    case 'constant': {
      const words = splitWords(input).map((w) => w.toLowerCase());
      if (words.length === 0) return { ok: true, value: '' };
      if (mode === 'snake') return { ok: true, value: words.join('_') };
      if (mode === 'kebab') return { ok: true, value: words.join('-') };
      if (mode === 'constant') return { ok: true, value: words.map((w) => w.toUpperCase()).join('_') };
      const pascal = words.map(capitalize).join('');
      if (mode === 'pascal') return { ok: true, value: pascal };
      return {
        ok: true,
        value: pascal.charAt(0).toLowerCase() + pascal.slice(1),
      };
    }
    default:
      return { ok: true, value: input };
  }
}
