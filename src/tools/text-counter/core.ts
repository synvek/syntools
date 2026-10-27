import type { ToolResult } from '@/core/types';

/**
 * Online text statistics: characters / words / lines / paragraphs / bytes, etc.
 */

export interface TextCountStats {
  /** Unicode code points (an emoji counts as 1) */
  chars: number;
  /** Code points excluding whitespace */
  charsNoSpace: number;
  /** UTF-16 code units (string.length) */
  utf16Length: number;
  /** UTF-8 byte count */
  bytes: number;
  /** Latin text is split on whitespace; each CJK character counts as one word */
  words: number;
  /** Number of CJK unified ideographs */
  cjk: number;
  lines: number;
  paragraphs: number;
  /** Number of whitespace characters */
  spaces: number;
}

export type TextCountError = 'EMPTY';

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
const WORD_RE = /[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?|[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/gu;

export function countTextStats(input: string): ToolResult<TextCountStats> {
  if (!input) return { ok: false, error: 'EMPTY' };

  const chars = [...input].length;
  const charsNoSpace = [...input.replace(/\s/g, '')].length;
  const utf16Length = input.length;
  const bytes = new TextEncoder().encode(input).length;
  const words = (input.match(WORD_RE) ?? []).length;
  const cjk = [...input].filter((ch) => CJK_RE.test(ch)).length;
  const lines = input.length === 0 ? 0 : input.split(/\r\n|\r|\n/).length;
  const paragraphs = input
    .trim()
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0).length;
  const spaces = (input.match(/\s/g) ?? []).length;

  return {
    ok: true,
    value: {
      chars,
      charsNoSpace,
      utf16Length,
      bytes,
      words,
      cjk,
      lines,
      paragraphs: paragraphs || (input.trim() ? 1 : 0),
      spaces,
    },
  };
}
