import { describe, expect, it } from 'vitest';
import type { TextLine } from '@/core/pdf/textLines';
import { blocksToHtml, structureLines } from './pdfStructure';

/** Build a normalized line: 12 pt body on an A4 page is ~0.018 in normalized height */
function line(
  text: string,
  options: Partial<TextLine> & { x?: number; y?: number; size?: number } = {},
): TextLine {
  const size = options.size ?? 12;
  return {
    page: 1,
    text,
    fontSize: size,
    rect: {
      x: options.x ?? 0.1,
      y: options.y ?? 0.1,
      w: options.rect?.w ?? 0.6,
      h: options.rect?.h ?? size / 800,
    },
    items: [],
  };
}

describe('structureLines', () => {
  it('明显大于正文的行成为标题，按比例分级', () => {
    const blocks = structureLines([
      line('Annual Report', { y: 0.05, size: 28 }),
      line('Part One', { y: 0.12, size: 20 }),
      line('Section A', { y: 0.18, size: 16 }),
      line('Body text', { y: 0.24, size: 12 }),
    ]);
    expect(blocks).toEqual([
      { kind: 'heading', level: 1, text: 'Annual Report' },
      { kind: 'heading', level: 2, text: 'Part One' },
      { kind: 'heading', level: 3, text: 'Section A' },
      { kind: 'paragraph', text: 'Body text' },
    ]);
  });

  it('同缩进、行距紧凑的正文行合并为一段', () => {
    const blocks = structureLines([
      line('第一行内容，', { y: 0.2 }),
      line('第二行接着写。', { y: 0.2 + 12 / 800 + 0.004 }),
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ kind: 'paragraph', text: '第一行内容，第二行接着写。' });
  });

  it('行距过大时另起一段', () => {
    const blocks = structureLines([line('One', { y: 0.2 }), line('Two', { y: 0.4 })]);
    expect(blocks).toHaveLength(2);
  });

  it('缩进跳变时另起一段', () => {
    const blocks = structureLines([
      line('Body', { y: 0.2, x: 0.1 }),
      line('Quote', { y: 0.2 + 12 / 800 + 0.004, x: 0.2 }),
    ]);
    expect(blocks).toHaveLength(2);
  });

  it('项目符号与编号分别聚成列表，且切换类型时断开', () => {
    const blocks = structureLines([
      line('• 甲', { y: 0.1 }),
      line('• 乙', { y: 0.12 }),
      line('1. 丙', { y: 0.14 }),
      line('2. 丁', { y: 0.16 }),
      line('正文', { y: 0.2 }),
    ]);
    expect(blocks).toEqual([
      { kind: 'list', ordered: false, items: ['甲', '乙'] },
      { kind: 'list', ordered: true, items: ['丙', '丁'] },
      { kind: 'paragraph', text: '正文' },
    ]);
  });

  it('中文与英文混排时只在英文侧补空格', () => {
    const blocks = structureLines([
      line('中文结尾', { y: 0.2 }),
      line('English starts', { y: 0.2 + 12 / 800 + 0.004 }),
    ]);
    expect(blocks[0]).toMatchObject({ text: '中文结尾English starts' });
  });

  it('长标题不当作标题（可能是正文大字）', () => {
    const long = 'A'.repeat(200);
    const blocks = structureLines([line(long, { y: 0.1, size: 24 }), line('body', { y: 0.2 })]);
    expect(blocks[0].kind).toBe('paragraph');
  });

  it('空输入返回空数组', () => {
    expect(structureLines([])).toEqual([]);
  });
});

describe('blocksToHtml', () => {
  it('输出可被 docx 读取的最小 HTML 并转义', () => {
    const html = blocksToHtml([
      { kind: 'heading', level: 2, text: 'A & B' },
      { kind: 'paragraph', text: '<tag>' },
      { kind: 'list', ordered: true, items: ['x', 'y'] },
    ]);
    expect(html).toContain('<h2>A &amp; B</h2>');
    expect(html).toContain('<p>&lt;tag&gt;</p>');
    expect(html).toContain('<ol><li>x</li><li>y</li></ol>');
  });
});
