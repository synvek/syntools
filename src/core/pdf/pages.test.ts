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

  it('requires password for encrypted PDFs', async () => {
    const { loadPdfFromBytes } = await import('./load');
    const bytes = await makeFixturePdf(1);
    const enc = await encryptPdf(bytes, { userPassword: 'secret' });
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;

    const denied = await loadPdfFromBytes(enc.value);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error).toBe('NEED_PASSWORD');

    const wrong = await loadPdfFromBytes(enc.value, { password: 'nope' });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error).toBe('WRONG_PASSWORD');

    const ok = await loadPdfFromBytes(enc.value, { password: 'secret' });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.getPageCount()).toBe(1);
  });

  it('keeps page numbers upright on rotated pages', async () => {
    const { degrees } = await import('@cantoo/pdf-lib');
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');

    for (const rot of [90, 180, 270] as const) {
      const doc = await PDFDocument.create();
      const page = doc.addPage([200, 300]);
      page.setRotation(degrees(rot));
      const numbered = await addPageNumbers(doc, {
        format: 'PAGE-MARK',
        position: 'bottom-center',
        fontSize: 12,
        margin: 20,
      });
      expect(numbered.ok).toBe(true);
      if (!numbered.ok) return;

      const pdf = await getDocument({
        data: numbered.value.slice(),
        useSystemFonts: true,
      }).promise;
      try {
        const pdfPage = await pdf.getPage(1);
        const viewport = pdfPage.getViewport({ scale: 1 });
        const content = await pdfPage.getTextContent();
        const mark = content.items.find(
          (item) => 'str' in item && String(item.str).includes('PAGE-MARK'),
        ) as { str: string; transform: number[] } | undefined;
        expect(mark, `missing mark at ${rot}`).toBeTruthy();
        if (!mark) return;

        const [a, b, , , e, f] = mark.transform;
        const p0 = viewport.convertToViewportPoint(e, f);
        const p1 = viewport.convertToViewportPoint(e + a, f + b);
        const dx = p1[0] - p0[0];
        const dy = p1[1] - p0[1];
        // As displayed: text runs horizontally and sits near the visual bottom-center.
        expect(Math.abs(dx), `not upright at ${rot}`).toBeGreaterThan(Math.abs(dy) * 2);
        expect(p0[1], `not near bottom at ${rot}`).toBeGreaterThan(viewport.height * 0.6);
        expect(p0[0], `not near centerX at ${rot}`).toBeGreaterThan(viewport.width * 0.15);
        expect(p0[0], `not near centerX at ${rot}`).toBeLessThan(viewport.width * 0.85);
      } finally {
        await pdf.cleanup();
      }
    }
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
