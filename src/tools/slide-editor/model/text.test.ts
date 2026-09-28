import { describe, expect, it } from 'vitest';
import {
  applyStyleRange,
  bodyToText,
  flattenBody,
  queryStyleRange,
  replaceBodyText,
  scaleBodyFonts,
} from './text';
import type { TextBody } from './types';

function body(paragraphs: TextBody['paragraphs'], extra: Partial<TextBody> = {}): TextBody {
  return {
    paragraphs,
    anchor: 'top',
    wrap: true,
    autoFit: 'none',
    margins: { left: 9, top: 5, right: 9, bottom: 5 },
    ...extra,
  };
}

describe('富文本展平与重建', () => {
  it('flattenBody 按字符展开并标记所属段落', () => {
    const chars = flattenBody(body([{ runs: [{ text: 'ab' }, { text: 'c' }] }]));
    expect(chars).toHaveLength(3);
    expect(chars.every((char) => char.paragraph === 0)).toBe(true);
    expect(bodyToText(body([{ runs: [{ text: 'ab' }, { text: 'c' }] }]))).toBe('abc');
  });

  it('段落之间插入分隔符', () => {
    const chars = flattenBody(body([{ runs: [{ text: 'A' }] }, { runs: [{ text: 'B' }] }]));
    expect(chars.map((c) => c.paragraph)).toEqual([0, -1, 1]);
    expect(bodyToText(body([{ runs: [{ text: 'A' }] }, { runs: [{ text: 'B' }] }]))).toBe('A\nB');
  });
});

describe('replaceBodyText：编辑后保留样式与段落属性', () => {
  it('在混排段落中间插入文字，其余 run 的样式保持不变', () => {
    const source = body([
      {
        runs: [
          { text: 'Hello ', style: { size: 20 } },
          { text: 'World', style: { size: 20, bold: true } },
        ],
      },
    ]);
    // 在 "Hello " 之后插入 "Big "
    const next = replaceBodyText(source, 'Hello Big World');
    const runs = next.paragraphs[0].runs;
    expect(bodyToText(next)).toBe('Hello Big World');
    // 插入的字符继承前一个字符（size 20，非粗体），尾部粗体 run 原样保留
    expect(runs.some((run) => run.text.includes('Big') && run.style?.size === 20)).toBe(true);
    expect(runs.some((run) => run.text === 'World' && run.style?.bold === true)).toBe(true);
  });

  it('删除中间一段文字后，两侧样式各自保留', () => {
    const source = body([
      {
        runs: [
          { text: 'AAA', style: { bold: true } },
          { text: 'BBB', style: { italic: true } },
          { text: 'CCC', style: { underline: true } },
        ],
      },
    ]);
    const next = replaceBodyText(source, 'AAACCC');
    expect(bodyToText(next)).toBe('AAACCC');
    expect(next.paragraphs[0].runs[0].style?.bold).toBe(true);
    expect(next.paragraphs[0].runs[1].style?.underline).toBe(true);
  });

  it('D2：编辑后 spaceBefore / spaceAfter / indent 不再丢失', () => {
    const source = body([
      {
        runs: [{ text: '标题' }],
        align: 'center',
        lineSpacing: 1.5,
        spaceBefore: 12,
        spaceAfter: 8,
        indent: 24,
      },
    ]);
    const next = replaceBodyText(source, '新标题');
    expect(next.paragraphs[0].spaceBefore).toBe(12);
    expect(next.paragraphs[0].spaceAfter).toBe(8);
    expect(next.paragraphs[0].indent).toBe(24);
    expect(next.paragraphs[0].lineSpacing).toBe(1.5);
    expect(next.paragraphs[0].align).toBe('center');
  });

  it('多段编辑时各段属性各自保留', () => {
    const source = body([
      { runs: [{ text: '一' }], spaceBefore: 10 },
      { runs: [{ text: '二' }], spaceAfter: 20 },
    ]);
    const next = replaceBodyText(source, '一改\n二改');
    expect(next.paragraphs).toHaveLength(2);
    expect(next.paragraphs[0].spaceBefore).toBe(10);
    expect(next.paragraphs[1].spaceAfter).toBe(20);
  });

  it('追加换行会新增段落并继承属性', () => {
    const source = body([{ runs: [{ text: 'A' }], align: 'right' }]);
    const next = replaceBodyText(source, 'A\nB');
    expect(next.paragraphs).toHaveLength(2);
    expect(bodyToText(next)).toBe('A\nB');
  });

  it('清空文本仍保留一个空段落', () => {
    const source = body([{ runs: [{ text: 'ABC' }] }]);
    const next = replaceBodyText(source, '');
    expect(next.paragraphs).toHaveLength(1);
    expect(bodyToText(next)).toBe('');
  });

  it('文本未变时结构与样式不变', () => {
    const source = body([{ runs: [{ text: 'A', style: { bold: true } }, { text: 'B' }] }]);
    const next = replaceBodyText(source, 'AB');
    expect(next.paragraphs[0].runs).toEqual(source.paragraphs[0].runs);
  });
});

describe('normAutofit 缩字', () => {
  it('scaleBodyFonts 等比缩小全部 run 字号', () => {
    const source = body([
      {
        runs: [
          { text: 'A', style: { size: 20 } },
          { text: 'B', style: { size: 10 } },
        ],
      },
    ]);
    const next = scaleBodyFonts(source, 0.5);
    expect(next.paragraphs[0].runs[0].style?.size).toBe(10);
    expect(next.paragraphs[0].runs[1].style?.size).toBe(5);
  });

  it('未设置字号的 run 按默认 18 缩放', () => {
    const next = scaleBodyFonts(body([{ runs: [{ text: 'A' }] }]), 0.5);
    expect(next.paragraphs[0].runs[0].style?.size).toBe(9);
  });

  it('factor 为 1 或非法时返回原对象（避免无意义重排）', () => {
    const source = body([{ runs: [{ text: 'A', style: { size: 20 } }] }]);
    expect(scaleBodyFonts(source, 1)).toBe(source);
    expect(scaleBodyFonts(source, 0)).toBe(source);
  });
});

describe('选区级样式', () => {
  const source = body([{ runs: [{ text: 'abcdef' }] }]);

  it('applyStyleRange 只给选区内字符加粗，并按需切分 run', () => {
    const next = applyStyleRange(source, 1, 3, { bold: true });
    const runs = next.paragraphs[0].runs;
    expect(runs.map((run) => run.text)).toEqual(['a', 'bc', 'def']);
    expect(runs[1].style?.bold).toBe(true);
    expect(runs[0].style?.bold).toBeUndefined();
  });

  it('applyStyleRange 空选区为空操作', () => {
    expect(applyStyleRange(source, 2, 2, { bold: true })).toBe(source);
  });

  it('queryStyleRange 判断选区是否整体具备某样式', () => {
    const mixed = applyStyleRange(source, 0, 6, { bold: true });
    expect(queryStyleRange(mixed, 0, 6).bold).toBe(true);
    const partial = applyStyleRange(mixed, 3, 6, { bold: false });
    expect(queryStyleRange(partial, 0, 6).bold).toBe(false);
    expect(queryStyleRange(partial, 0, 3).bold).toBe(true);
  });

  it('选区样式可以叠加多个标记', () => {
    const next = applyStyleRange(applyStyleRange(source, 0, 2, { bold: true }), 0, 2, {
      italic: true,
    });
    expect(next.paragraphs[0].runs[0].style).toMatchObject({ bold: true, italic: true });
  });
});
