import { describe, expect, it } from 'vitest';
import {
  clampOffset,
  countLines,
  lineColToOffset,
  lineEndOffset,
  lineSpans,
  lineStartOffset,
  offsetToLineCol,
  splitLines,
} from './lines';

describe('文本行原语', () => {
  it('按 LF / CRLF / CR 拆分，CRLF 不拆成两行', () => {
    expect(splitLines('')).toEqual(['']);
    expect(splitLines('a\nb')).toEqual(['a', 'b']);
    expect(splitLines('a\r\nb')).toEqual(['a', 'b']);
    expect(splitLines('a\rb')).toEqual(['a', 'b']);
    expect(splitLines('a\n')).toEqual(['a', '']);
    expect(splitLines('\n')).toEqual(['', '']);
  });

  it('行数口径与编辑器视觉一致（空文本 1 行）', () => {
    expect(countLines('')).toBe(1);
    expect(countLines('a')).toBe(1);
    expect(countLines('a\nb')).toBe(2);
    expect(countLines('a\n')).toBe(2);
    expect(countLines('a\r\nb\r\n')).toBe(3);
  });

  it('行片段带上原文偏移', () => {
    expect(lineSpans('a\r\nbc')).toEqual([
      { line: 1, start: 0, end: 1, text: 'a' },
      { line: 2, start: 3, end: 5, text: 'bc' },
    ]);
  });

  it('偏移转行列', () => {
    const text = 'a\nb';
    expect(offsetToLineCol(text, 0)).toEqual({ line: 1, col: 0 });
    expect(offsetToLineCol(text, 1)).toEqual({ line: 1, col: 1 });
    // 偏移落在换行符上 → 归到该行行尾
    expect(offsetToLineCol('a\r\nb', 2)).toEqual({ line: 1, col: 1 });
    // 偏移等于下一行行首 → 归到下一行
    expect(offsetToLineCol(text, 2)).toEqual({ line: 2, col: 0 });
    expect(offsetToLineCol(text, 3)).toEqual({ line: 2, col: 1 });
    // 末尾空行
    expect(offsetToLineCol('a\n', 2)).toEqual({ line: 2, col: 0 });
  });

  it('偏移越界与非有限值被钳制', () => {
    expect(offsetToLineCol('abc', 99)).toEqual({ line: 1, col: 3 });
    expect(offsetToLineCol('abc', -5)).toEqual({ line: 1, col: 0 });
    expect(offsetToLineCol('abc', Number.NaN)).toEqual({ line: 1, col: 0 });
    expect(clampOffset('abc', Number.POSITIVE_INFINITY)).toBe(3);
    expect(clampOffset('abc', 1.9)).toBe(1);
  });

  it('行列转偏移，越界钳制到有效范围', () => {
    const text = 'a\nbc';
    expect(lineColToOffset(text, 1, 0)).toBe(0);
    expect(lineColToOffset(text, 2, 1)).toBe(3);
    expect(lineColToOffset(text, 2, 99)).toBe(4);
    expect(lineColToOffset(text, 99, 99)).toBe(4);
    expect(lineColToOffset(text, 0, 0)).toBe(0);
    expect(lineColToOffset(text, Number.NaN, Number.NaN)).toBe(0);
  });

  it('取行首 / 行尾偏移', () => {
    const text = 'a\nbc';
    expect(lineStartOffset(text, 2)).toBe(2);
    expect(lineEndOffset(text, 1)).toBe(1);
    expect(lineEndOffset(text, 2)).toBe(4);
    expect(lineEndOffset(text, 99)).toBe(4);
  });
});
