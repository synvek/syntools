import { describe, expect, it } from 'vitest';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  blocksToPlainText,
  collectPdfText,
  encodeText,
  joinPageTexts,
  textFileName,
} from './exportText';

describe('blocksToPlainText', () => {
  it('标题/段落/列表转为可读纯文本', () => {
    const text = blocksToPlainText([
      { kind: 'heading', level: 1, text: '标题' },
      { kind: 'paragraph', text: '正文' },
      { kind: 'list', ordered: false, items: ['甲', '乙'] },
      { kind: 'list', ordered: true, items: ['一', '二'] },
    ]);
    expect(text).toBe('标题\n\n正文\n\n- 甲\n- 乙\n\n1. 一\n2. 二');
  });

  it('空块返回空串', () => {
    expect(blocksToPlainText([])).toBe('');
  });
});

describe('joinPageTexts / textFileName / encodeText', () => {
  it('跳过空页并以空行分隔', () => {
    expect(joinPageTexts(['a', '  ', 'b'])).toBe('a\n\nb');
  });

  it('文件名为 .txt', () => {
    expect(textFileName('report.pdf')).toBe('report.txt');
    expect(textFileName('')).toBe('document.txt');
  });

  it('UTF-8 编码保留中文', () => {
    expect(Array.from(encodeText('中'))).toEqual([0xe4, 0xb8, 0xad]);
  });
});

describe('collectPdfText', () => {
  const fakeDoc = (pages: Record<number, unknown[]>): PDFDocumentProxy =>
    ({
      getPage: async (pageNumber: number) => ({
        getViewport: () => ({ width: 600, height: 800, transform: [1, 0, 0, -1, 0, 800] }),
        getTextContent: async () => ({ items: pages[pageNumber] ?? [] }),
      }),
    }) as unknown as PDFDocumentProxy;

  it('拼接有文本的页，并记录空白页与行数', async () => {
    const doc = fakeDoc({
      1: [{ str: 'Hello', transform: [12, 0, 0, 12, 72, 700], width: 30, height: 12 }],
      2: [],
      3: [{ str: 'World', transform: [12, 0, 0, 12, 72, 700], width: 30, height: 12 }],
    });
    const result = await collectPdfText(doc, [1, 2, 3]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text).toBe('Hello\n\nWorld');
    expect(result.value.lines).toBe(2);
    expect(result.value.emptyPages).toEqual([2]);
  });

  it('没有页码范围时报 NO_PAGES', async () => {
    const result = await collectPdfText(fakeDoc({}), []);
    expect(result).toEqual({ ok: false, error: 'NO_PAGES' });
  });
});
