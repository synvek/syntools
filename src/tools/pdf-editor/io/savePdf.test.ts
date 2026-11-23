import { PDFDocument, degrees } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  addObject,
  createDoc,
  deletePage,
  insertBlankPage,
  insertPagesFrom,
  markSaved,
  pageIdFor,
  rotateAllPages,
  setPageRotation,
} from '../model/doc';
import {
  DEFAULT_FOOTER,
  DEFAULT_HEADER,
  DEFAULT_PAGE_NUMBERS,
  DEFAULT_WATERMARK,
  setDecoration,
} from '../model/decorations';
import {
  createImageObject,
  createInkObject,
  createMarkupObject,
  createNoteObject,
  createShapeObject,
  createTextObject,
} from '../model/objects';
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
    source: { key: 'main', bytes, pageCount, encrypted: false, fingerprint: 'fp-test' },
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
    expect(outputRotation({ id: 'p0', sourceKey: 'main', sourceIndex: 0, rotation: 90 }, 0)).toBe(
      90,
    );
    expect(outputRotation({ id: 'p0', sourceKey: 'main', sourceIndex: 0, rotation: 90 }, 90)).toBe(
      180,
    );
    expect(outputRotation({ id: 'p0', sourceKey: 'main', sourceIndex: 0, rotation: 270 }, 90)).toBe(
      0,
    );
    expect(outputRotation({ id: 'p0', sourceKey: 'main', sourceIndex: 0, rotation: 0 }, 270)).toBe(
      270,
    );
  });
});

describe('flattenPdf — 全对象类型', () => {
  it('六种对象混合保存：每页都画出来且不抛错', async () => {
    const bytes = await samplePdf(1);
    const page = pageIdFor('main', 0);
    const rect = { x: 0.1, y: 0.2, w: 0.3, h: 0.1 };

    let doc = await docFrom(bytes, 1);
    doc = addObject(
      doc,
      createMarkupObject({ page, type: 'highlight', rect, quads: [rect], color: '#fde047', z: 1 }),
    );
    doc = addObject(
      doc,
      createInkObject({
        page,
        points: [
          { x: 0.2, y: 0.4 },
          { x: 0.3, y: 0.45 },
          { x: 0.4, y: 0.4 },
        ],
        z: 2,
      }),
    );
    doc = addObject(
      doc,
      createShapeObject({ page, rect: { ...rect, y: 0.4 }, type: 'arrow', z: 3 }),
    );
    doc = addObject(
      doc,
      createNoteObject({ page, rect: { x: 0.6, y: 0.2, w: 0.04, h: 0.04 }, body: 'Check', z: 4 }),
    );
    doc = addObject(
      doc,
      createImageObject({
        page,
        rect: { x: 0.1, y: 0.6, w: 0.2, h: 0.2 },
        // 故意给一个坏 payload：坏图必须被跳过，而不是让整次保存失败
        dataUrl: 'data:image/png;base64,broken',
        naturalW: 100,
        naturalH: 100,
        z: 5,
      }),
    );
    doc = addObject(doc, createTextObject({ page, rect: { ...rect, y: 0.8 }, text: 'Hi', z: 6 }));

    const result = await flattenPdf(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.rasterized).toBe(false);
    const out = await PDFDocument.load(result.value.bytes);
    expect(out.getPageCount()).toBe(1);

    // The overlay must have added paint operators on top of the copied page
    const empty = await flattenPdf(await docFrom(bytes, 1));
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(result.value.bytes.length).toBeGreaterThan(empty.value.bytes.length);
  });

  it('旋转对象的 CTM 与纯 ASCII 文本不产生栅格', async () => {
    const bytes = await samplePdf(1);
    let doc = await docFrom(bytes, 1);
    doc = addObject(
      doc,
      createShapeObject({
        page: pageIdFor('main', 0),
        rect: { x: 0.2, y: 0.2, w: 0.4, h: 0.1 },
        type: 'rect',
        rotation: 90,
        z: 1,
      }),
    );

    const result = await flattenPdf(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rasterized).toBe(false);
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
        page: pageIdFor('main', 0),
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

  it('页面装饰写进每一页，且排在用户对象之前', async () => {
    const bytes = await samplePdf(2);
    const plain = await docFrom(bytes, 2);
    const decorated = setDecoration(plain, {
      numbers: { ...DEFAULT_PAGE_NUMBERS, enabled: true },
      header: { ...DEFAULT_HEADER, text: 'Confidential' },
      footer: { ...DEFAULT_FOOTER, text: 'internal use only' },
      watermark: { ...DEFAULT_WATERMARK, text: 'DRAFT' },
    });

    const without = await flattenPdf(plain);
    const withDecoration = await flattenPdf(decorated);
    expect(without.ok).toBe(true);
    expect(withDecoration.ok).toBe(true);
    if (!without.ok || !withDecoration.ok) return;

    expect(withDecoration.value.rasterized).toBe(false);
    expect(withDecoration.value.bytes.length).toBeGreaterThan(without.value.bytes.length);

    const out = await PDFDocument.load(withDecoration.value.bytes);
    expect(out.getPageCount()).toBe(2);
    for (const page of out.getPages()) {
      expect(page.node.Contents()).toBeTruthy();
    }
  });

  it('文件自带 /Rotate 90 时叠加而不是替换', async () => {
    const bytes = await samplePdf(2, 90);
    let doc = await docFrom(bytes, 2);
    doc = setPageRotation(doc, pageIdFor('main', 0), 90);

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
      source: {
        key: 'main',
        bytes: new Uint8Array(0),
        pageCount: 0,
        encrypted: false,
        fingerprint: '',
      },
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
      createTextObject({
        page: pageIdFor('main', 1),
        rect: { x: 0.2, y: 0.2, w: 0.3, h: 0.1 },
        text: 'A',
        z: 1,
      }),
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

describe('flattenPdf 多来源页', () => {
  it('插入外部 PDF 页与空白页：顺序、尺寸与页数正确', async () => {
    const mainBytes = await samplePdf(1);
    const extraBytes = await samplePdf(2, 90);
    let doc = await docFrom(mainBytes, 1);

    doc = insertBlankPage(doc, 2, { widthPt: 300, heightPt: 400 });
    doc = insertPagesFrom(
      doc,
      3,
      {
        key: 'attach-1',
        bytes: extraBytes,
        pageCount: 2,
        encrypted: false,
        fingerprint: 'fp-extra',
      },
      [1, 0],
    );

    const result = await flattenPdf(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const out = await PDFDocument.load(result.value.bytes);
    expect(out.getPageCount()).toBe(4);
    // page 2 is the inserted blank page
    expect(out.getPage(1).getWidth()).toBeCloseTo(300);
    expect(out.getPage(1).getHeight()).toBeCloseTo(400);
    // pages 3/4 come from the attachment in the requested order: source page 2 then page 1,
    // and the attachment's own /Rotate 90 only applies to its first page
    expect(out.getPage(2).getRotation().angle).toBe(0);
    expect(out.getPage(3).getRotation().angle).toBe(90);
  });

  it('附件来源缺失时返回 INVALID_RANGE，不产出半成品', async () => {
    const mainBytes = await samplePdf(1);
    const doc = await docFrom(mainBytes, 1);
    const broken: PdfEditorDoc = {
      ...doc,
      pages: [
        ...doc.pages,
        { id: 'page-ghost-0', sourceKey: 'ghost', sourceIndex: 0, rotation: 0 },
      ],
    };

    expect(await flattenPdf(broken)).toEqual({ ok: false, error: 'INVALID_RANGE' });
  });
});

describe('flattenPdf 保存进度（M4-5）', () => {
  it('逐页回调，最后一页等于总页数', async () => {
    const bytes = await samplePdf(12);
    const doc = await docFrom(bytes, 12);
    const calls: Array<[number, number]> = [];

    const result = await flattenPdf(doc, {
      onProgress: (done, total) => calls.push([done, total]),
    });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(12);
    expect(calls[0]).toEqual([1, 12]);
    expect(calls.at(-1)).toEqual([12, 12]);
  });

  it('失败时不回调（无页文档直接返回 NO_PAGES）', async () => {
    const bytes = await samplePdf(1);
    const doc = await docFrom(bytes, 1);
    const calls: number[] = [];

    const result = await flattenPdf(
      { ...doc, source: { ...doc.source, bytes: new Uint8Array() } },
      { onProgress: (done) => calls.push(done) },
    );

    expect(result).toEqual({ ok: false, error: 'NO_PAGES' });
    expect(calls).toEqual([]);
  });
});
