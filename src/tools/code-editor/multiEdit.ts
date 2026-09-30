import { findMatches } from './findReplace';

/**
 * 批量编辑纯逻辑（阶段 5）。
 *
 * 定位说明：编辑区由 CodeJar 托管，浏览器对 contenteditable 的多选区支持极差，
 * 因此这里**不做**任意点插入式多光标，而是提供等效价值更高的形态：
 * 「选中所有同词 → 统一替换」+ 已有的多行行操作（注释 / 缩进 / 移动）。
 */

const WORD_RE = /[\p{L}\p{N}_]/u;

export interface TextRange {
  start: number;
  end: number;
}

export interface WordSelection {
  /** 光标所在的词 */
  word: string;
  /** 全文中该词的所有位置（含当前光标处） */
  ranges: TextRange[];
}

/** 是否为词字符（Unicode 字母 / 数字 / 下划线，中英文均适用） */
export function isWordChar(char: string | undefined): boolean {
  return Boolean(char) && WORD_RE.test(char!);
}

/** 取 `offset` 处（或紧邻其前）的词；不在词上返回 null */
export function wordAtOffset(text: string, offset: number): string | null {
  let start = offset;
  let end = offset;
  if (!isWordChar(text[offset])) {
    if (!isWordChar(text[offset - 1])) return null;
    start = offset - 1;
    end = offset;
  }
  while (start > 0 && isWordChar(text[start - 1])) start -= 1;
  while (end < text.length && isWordChar(text[end])) end += 1;
  return text.slice(start, end) || null;
}

/** 全文中所有同词位置（默认区分大小写，与「重命名」预期一致） */
export function wordRanges(text: string, offset: number, matchCase = true): WordSelection | null {
  const word = wordAtOffset(text, offset);
  if (!word) return null;
  const found = findMatches(text, word, { wholeWord: true, matchCase });
  if (!found.ok) return null;
  return {
    word,
    ranges: found.value.matches.map((match) => ({ start: match.start, end: match.end })),
  };
}

/** 用同一文本改写多处区间（从后往前应用，避免偏移错乱；要求 ranges 升序且不重叠） */
export function replaceRanges(text: string, ranges: TextRange[], replacement: string): string {
  let next = text;
  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    const range = ranges[index]!;
    next = next.slice(0, range.start) + replacement + next.slice(range.end);
  }
  return next;
}
