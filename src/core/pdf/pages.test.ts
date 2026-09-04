import { describe, expect, it } from 'vitest';
import { PDFDocument } from '@cantoo/pdf-lib';
import { loadFixture, makeFixturePdf } from './fixture';
import { parsePageSelection } from './load';
import {
  mergePdfs,
  splitPdfToPages,
  deletePages,
  extractPages,
  reorderPages,
  rotatePages,
} from './pages';
import { addPageNumbers, setPdfMetadata, cropPages, annotatePages } from './draw';
import { encryptPdf } from './security';
import { imagesToPdf } from './convert';

describe('parsePageSelection', () => {
  it('parses ranges', () => {
    const r = parsePageSelection('1,3-5', 6);
    expect(r.ok && r.value).toEqual([0, 2, 3, 4]);
  });
  it('rejects invalid', () => {
    expect(parsePageSelection('0', 3).ok).toBe(false);
    expect(parsePageSelection('1-9', 3).ok).toBe(false);
  });
});

describe('page ops', () => {
  it('merges', async () => {
    const a = await loadFixture(2);
    const b = await loadFixture(1);
    const r = await mergePdfs([a, b]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const doc = await PDFDocument.load(r.value);
      expect(doc.getPageCount()).toBe(3);
    }
  });

  it('splits', async () => {
    const doc = await loadFixture(3);
    const r = await splitPdfToPages(doc);
    expect(r.ok && r.value.length).toBe(3);
  });

  it('deletes pages', async () => {
    const doc = await loadFixture(4);
    const r = await deletePages(doc, [1, 2]);
    expect(r.ok).toBe(true);
    if (r.ok) expect((await PDFDocument.load(r.value)).getPageCount()).toBe(2);
  });

  it('extracts pages', async () => {
    const doc = await loadFixture(4);
    const r = await extractPages(doc, [0, 3]);
    expect(r.ok).toBe(true);
    if (r.ok) expect((await PDFDocument.load(r.value)).getPageCount()).toBe(2);
  });

  it('reorders', async () => {
    const doc = await loadFixture(3);
    const r = await reorderPages(doc, [2, 0, 1]);
    expect(r.ok).toBe(true);
  });

  it('rotates', async () => {
    const doc = await loadFixture(2);
    const r = await rotatePages(doc, [0], 90);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const d = await PDFDocument.load(r.value);
      expect(d.getPage(0).getRotation().angle).toBe(90);
    }
  });
});

describe('draw & security', () => {
  it('adds page numbers', async () => {
    const doc = await loadFixture(2);
    const r = await addPageNumbers(doc, { format: 'p{n}' });
    expect(r.ok).toBe(true);
  });

  it('sets metadata', async () => {
    const doc = await loadFixture(1);
    const r = await setPdfMetadata(doc, { title: 'T', author: 'A' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const d = await PDFDocument.load(r.value);
      expect(d.getTitle()).toBe('T');
      expect(d.getAuthor()).toBe('A');
    }
  });

  it('crops', async () => {
    const doc = await loadFixture(1);
    const r = await cropPages(doc, { top: 10, right: 10, bottom: 10, left: 10 });
    expect(r.ok).toBe(true);
  });

  it('annotates', async () => {
    const doc = await loadFixture(1);
    const r = await annotatePages(doc, [
      { kind: 'highlight', pageIndex: 0, x: 10, y: 10, width: 40, height: 12 },
    ]);
    expect(r.ok).toBe(true);
  });

  it('encrypts', async () => {
    const bytes = await makeFixturePdf(1);
    const r = await encryptPdf(bytes, { userPassword: 'secret' });
    expect(r.ok).toBe(true);
  });
});

describe('imagesToPdf', () => {
  it('rejects empty', async () => {
    const r = await imagesToPdf([]);
    expect(r.ok).toBe(false);
  });
});
