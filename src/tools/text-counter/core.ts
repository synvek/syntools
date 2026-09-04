import type { ToolResult } from '@/core/types';

/**
 * 在线字数统计：字符 / 单词 / 行 / 段落 / 字节等。
 */

export interface TextCountStats {
  /** Unicode 码点数（emoji 计 1） */
  chars: number;
  /** 不含空白的码点数 */
  charsNoSpace: number;
  /** UTF-16 代码单元数（string.length） */
  utf16Length: number;
  /** UTF-8 字节数 */
  bytes: number;
  /** 英文按空白分词；连续 CJK 字各计 1 词 */
  words: number;
  /** CJK 统一表意文字数量 */
  cjk: number;
  lines: number;
  paragraphs: number;
  /** 空白字符数 */
  spaces: number;
}

export type TextCountError = 'EMPTY';

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
const WORD_RE =
  /[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?|[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/gu;

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
