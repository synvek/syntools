import { findMatches } from './findReplace';

/**
 * Batch editing pure logic (phase 5).
 *
 * Scope note: the editing surface is owned by CodeJar and browsers support multi-selection in
 * contenteditable poorly, so this module deliberately **avoids** free-form multi-cursor insertion
 * and instead offers the higher-value equivalents: "select all occurrences of a word → replace
 * them together", plus the existing multi-line operations (comment / indent / move).
 */

const WORD_RE = /[\p{L}\p{N}_]/u;

export interface TextRange {
  start: number;
  end: number;
}

export interface WordSelection {
  /** Word under the caret */
  word: string;
  /** Every occurrence of that word in the document (including the caret position) */
  ranges: TextRange[];
}

/** Whether the character is a word character (Unicode letter / digit / underscore, CJK included) */
export function isWordChar(char: string | undefined): boolean {
  return Boolean(char) && WORD_RE.test(char!);
}

/** Word at `offset` (or immediately before it); returns null when not on a word */
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

/** All occurrences of the same word (case-sensitive by default, matching rename expectations) */
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

/** Overwrite several ranges with the same text (applied back to front so offsets stay valid; ranges must be sorted and non-overlapping) */
export function replaceRanges(text: string, ranges: TextRange[], replacement: string): string {
  let next = text;
  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    const range = ranges[index]!;
    next = next.slice(0, range.start) + replacement + next.slice(range.end);
  }
  return next;
}
