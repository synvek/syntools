import { describe, expect, it } from 'vitest';
import { splitHighlightedLines } from './highlightLines';
import { highlightCode } from './prism';

describe('splitHighlightedLines', () => {
  it('空输入返回单个空行', () => {
    expect(splitHighlightedLines('')).toEqual(['']);
  });

  it('按行切分并把每行还原为纯文本', () => {
    const html = highlightCode('const a = 1;\nconst b = 2;', 'javascript');
    const lines = splitHighlightedLines(html);
    expect(lines).toHaveLength(2);
    const textOf = (line: string) =>
      line
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
    expect(textOf(lines[0]!)).toBe('const a = 1;');
    expect(textOf(lines[1]!)).toBe('const b = 2;');
  });

  it('跨行的块注释在每行重新打开同 class 的 span（标签配平）', () => {
    const html = highlightCode('/*\n comment\n*/\nconst a = 1;', 'javascript');
    const lines = splitHighlightedLines(html);
    expect(lines).toHaveLength(4);
    for (const line of lines) {
      const open = (line.match(/<span/g) ?? []).length;
      const close = (line.match(/<\/span>/g) ?? []).length;
      expect(open).toBe(close);
    }
    expect(lines[1]).toContain('token');
  });

  it('转义字符在切分后仍保持转义', () => {
    const lines = splitHighlightedLines(highlightCode('a < b &&\nc > d;', 'javascript'));
    expect(lines[0]).toContain('&lt;');
    expect(lines[0]).toContain('&amp;');
  });
});
