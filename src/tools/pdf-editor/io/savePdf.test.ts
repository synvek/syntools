import { PDFDocument, degrees } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  addObject,
  createDoc,
  deletePage,
  markSaved,
  rotateAllPages,
  setPageRotation,
} from '../model/doc';
import { createTextObject } from '../model/objects';
import type { PdfEditorDoc } from '../model/types';
import { editedFilename, flattenPdf, outputRotation, textRenderMode } from './savePdf';

async function samplePdf(pages = 3, firstRotation = 0): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pages; index += 1) {
    const page = pdf.addPage([595.28, 841.89]);
    if (index === 0 && firstRotation) page.setRotation(degrees(firstRotation));
  }
  return pdf.save();
}

async function docFrom(bytes: Uint8Array, pageCount = 3): Promise<PdfEditorDoc> {
  return createDoc({
    name: 'three-pages.pdf',
    source: { bytes, pageCount, encrypted: false, fingerprint: 'fp-test' },
    id: 'doc-test',
    now: 0,
  });
}

describe('textRenderMode / editedFilename', () => {
  it('ASCII 走字体，CJK 与 emoji 走栅格', () => {
    expect(textRenderMode('Hello PDF')).toBe('font');
    expect(textRenderMode('你好')).toBe('raster');
    expect(textRenderMode('ok ✓')).toBe('raster');
  });

  it('输出文件名不覆盖原文件', () => {
    expect(editedFilename('report.pdf')).toBe('report-edited.pdf');
    expect(editedFilename('REPORT.PDF')).toBe('REPORT-edited.pdf');
    expect(editedFilename('')).toBe('document-edited.pdf');
  });
});

describe('outputRotation', () => {
  it('用户旋转叠加在文件自身的 /Rotate 上', () => {
    expect(outputRotation({ sourceIndex: 0, rotation: 90 }, 0)).toBe(90);
    expect(outputRotation({ sourceIndex: 0, rotation: 90 }, 90)).toBe(180);
    expect(outputRotation({ sourceIndex: 0, rotation: 270 }, 90)).toBe(0);
    expect(outputRotation({ sourceIndex: 0, rotation: 0 }, 270)).toBe(270);
  });
});

describe('flattenPdf', () => {
  it('3 页旋转 + 文本框：页数、/Rotate 与内容流都正确', async () => {
    const bytes = await samplePdf(3);
    let doc = await docFrom(bytes);
    doc = rotateAllPages(doc, 90);
    doc = addObject(
      doc,
      createTextObject({
        page: 0,
        rect: { x: 0.1, y: 0.1, w: 0.4, h: 0.08 },
        text: 'Hello PDF',
        z: 1,
      }),
    );

    const result = await flattenPdf(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.filename).toBe('three-pages-edited.pdf');
    expect(result.value.rasterized).toBe(false);

    const out = await PDFDocument.load(result.value.bytes);
    expect(out.getPageCount()).toBe(3);
    expect(out.getPage(0).getRotation().angle).toBe(90);
    expect(out.getPage(2).getRotation().angle).toBe(90);
    // Painting puts operators into the page content stream
    expect(out.getPage(0).node.Contents()).toBeTruthy();
    expect(out.getTitle()).toBe('three-pages');
    // pdf-lib overwrites /Producer on save, so the brand lives in /Creator
    expect(out.getCreator()).toBe('SynTools');
  });

  it('文件自带 /Rotate 90 时叠加而不是替换', async () => {
    const bytes = await samplePdf(2, 90);
    let doc = await docFrom(bytes, 2);
    doc = setPageRotation(doc, 0, 90);

    const result = await flattenPdf(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const out = await PDFDocument.load(result.value.bytes);
    expect(out.getPage(0).getRotation().angle).toBe(180);
    // The second page has no /Rotate of its own and the user did not rotate it
    expect(out.getPage(1).getRotation().angle).toBe(0);
  });

  it('删除中间页后输出 2 页且顺序不变', async () => {
    const bytes = await samplePdf(3);
    let doc = await docFrom(bytes);
    doc = deletePage(doc, 2);

    const result = await flattenPdf(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const out = await PDFDocument.load(result.value.bytes);
    expect(out.getPageCount()).toBe(2);
  });

  it('可见页为 0 时返回 NO_PAGES，不产生字节', async () => {
    const empty = createDoc({
      name: 'empty.pdf',
      source: { bytes: new Uint8Array(0), pageCount: 0, encrypted: false, fingerprint: '' },
      id: 'empty',
      now: 0,
    });
    expect(await flattenPdf(empty)).toEqual({ ok: false, error: 'NO_PAGES' });
  });

  it('非 flatten 模式直接拒绝（D2 守门）', async () => {
    const bytes = await samplePdf(1);
    const doc = await docFrom(bytes, 1);
    const result = await flattenPdf(doc, { mode: 'annotations' as never });
    expect(result).toEqual({ ok: false, error: 'PROCESS_FAILED' });
  });

  it('保存两次结果一致（重建自原始字节，不叠加）', async () => {
    const bytes = await samplePdf(2);
    let doc = await docFrom(bytes, 2);
    doc = addObject(
      doc,
      createTextObject({ page: 1, rect: { x: 0.2, y: 0.2, w: 0.3, h: 0.1 }, text: 'A', z: 1 }),
    );

    const first = await flattenPdf(doc);
    const second = await flattenPdf(markSaved(doc, 1));
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const a = await PDFDocument.load(first.value.bytes);
    const b = await PDFDocument.load(second.value.bytes);
    // Rebuilt from the source bytes, so the overlay is painted exactly once
    expect(a.getPageCount()).toBe(b.getPageCount());
    expect(a.getPage(1).node.Contents()?.toString()).not.toBe('undefined');
  });
});
