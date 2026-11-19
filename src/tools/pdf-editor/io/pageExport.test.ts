import { PDFDocument } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';
import { createDoc } from '../model/doc';
import type { PdfEditorDoc } from '../model/types';
import { buildPageEntries, pageEntryName, zipName } from './pageExport';

async function samplePdf(pages = 3): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pages; index += 1) pdf.addPage([595.28, 841.89]);
  return pdf.save();
}

async function threePageDoc(name = 'report.pdf'): Promise<PdfEditorDoc> {
  const bytes = await samplePdf(3);
  return createDoc({
    name,
    source: { key: 'main', bytes, pageCount: 3, encrypted: false, fingerprint: 'fp' },
    id: 'doc-test',
    now: 0,
  });
}

describe('pageEntryName / zipName', () => {
  it('去掉扩展名并补零', () => {
    expect(pageEntryName('report.pdf', 3)).toBe('report-p03.pdf');
    expect(pageEntryName('REPORT.PDF', 12)).toBe('REPORT-p12.pdf');
    expect(pageEntryName('', 1)).toBe('document-p01.pdf');
    expect(zipName('report.pdf')).toBe('report-pages.zip');
  });
});

describe('buildPageEntries', () => {
  it('按给定页序每页一个单页 PDF', async () => {
    const doc = await threePageDoc();
    const result = await buildPageEntries(doc, [3, 1]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((entry) => entry.name)).toEqual(['report-p03.pdf', 'report-p01.pdf']);

    for (const entry of result.value) {
      const pdf = await PDFDocument.load(entry.bytes);
      expect(pdf.getPageCount()).toBe(1);
    }
  });

  it('忽略越界页码，全部越界时返回空数组', async () => {
    const doc = await threePageDoc();
    const result = await buildPageEntries(doc, [0, 9]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });
});
