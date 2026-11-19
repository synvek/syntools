import { PDFDocument } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';
import { MAX_IMPORT_BYTES, parsePageRange, readPdfSource, sourceFingerprint } from './pageImport';

async function samplePdf(pages = 3): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pages; index += 1) pdf.addPage([595.28, 841.89]);
  return pdf.save();
}

describe('parsePageRange', () => {
  it('空输入表示全部页', () => {
    expect(parsePageRange('', 3)).toEqual([0, 1, 2]);
    expect(parsePageRange('   ', 3)).toEqual([0, 1, 2]);
  });

  it('支持区间、单页与逗号混排', () => {
    expect(parsePageRange('1-3,5', 6)).toEqual([0, 1, 2, 4]);
    expect(parsePageRange(' 3 , 1 ', 3)).toEqual([0, 2]);
    expect(parsePageRange('2-2', 3)).toEqual([1]);
  });

  it('去重并排序', () => {
    expect(parsePageRange('3,1-2,2', 3)).toEqual([0, 1, 2]);
  });

  it('越界、倒序与非法字符返回空', () => {
    expect(parsePageRange('0', 3)).toEqual([]);
    expect(parsePageRange('4', 3)).toEqual([]);
    expect(parsePageRange('5-3', 6)).toEqual([]);
    expect(parsePageRange('1-4', 3)).toEqual([]);
    expect(parsePageRange('abc', 3)).toEqual([]);
    expect(parsePageRange('1,,2', 3)).toEqual([]);
    expect(parsePageRange('1-', 3)).toEqual([]);
  });

  it('没有页面的文档返回空', () => {
    expect(parsePageRange('1', 0)).toEqual([]);
  });
});

describe('sourceFingerprint', () => {
  it('拼上修改时间，缺失时用 0', () => {
    expect(sourceFingerprint('a.pdf', 12, 345)).toBe('a.pdf:12:345');
    expect(sourceFingerprint('a.pdf', 12, undefined)).toBe('a.pdf:12:0');
  });
});

describe('readPdfSource', () => {
  it('解析页数并保留字节', async () => {
    const bytes = await samplePdf(3);
    const result = await readPdfSource({ name: 'other.pdf', size: bytes.length, bytes });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pageCount).toBe(3);
    expect(result.value.encrypted).toBe(false);
    expect(result.value.bytes).toBe(bytes);
    expect(result.value.fingerprint).toBe(`other.pdf:${bytes.length}:0`);
  });

  it('超过大小上限直接拒绝', async () => {
    const result = await readPdfSource({
      name: 'huge.pdf',
      size: MAX_IMPORT_BYTES + 1,
      bytes: new Uint8Array([1]),
    });

    expect(result).toEqual({ ok: false, error: 'TOO_LARGE' });
  });

  it('不是 PDF 时报读取失败', async () => {
    const result = await readPdfSource({
      name: 'broken.pdf',
      size: 3,
      bytes: new Uint8Array([1, 2, 3]),
    });

    expect(result).toEqual({ ok: false, error: 'LOAD_FAILED' });
  });
});
