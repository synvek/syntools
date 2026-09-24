import { describe, expect, it } from 'vitest';
import { extractPdfText, joinTextItems } from './core';

describe('joinTextItems', () => {
  it('拼接文本项并压缩空白', () => {
    expect(joinTextItems([{ str: 'Hello' }, { str: 'World' }, { str: '' }])).toBe('Hello World');
  });
  it('忽略无 str 的项', () => {
    expect(joinTextItems([{ str: 'a' }, { str: undefined }])).toBe('a');
  });
});

describe('extractPdfText', () => {
  it('拒绝非 PDF 文件', async () => {
    const file = new File(['x'], 'note.txt', { type: 'text/plain' });
    expect(await extractPdfText(file)).toEqual({ ok: false, error: 'NOT_PDF' });
  });
});
