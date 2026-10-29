import { inflateSync } from 'node:zlib';
import { PDFDocument } from '@cantoo/pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { createDoc, createShapeElement, createTextElement } from '../model/factory';
import type { LineElement, SlideDoc } from '../model/types';
import {
  elementIsVectorSafe,
  exportSlidesToVectorPdf,
  isEncodableText,
  slideIsVectorSafe,
} from './pdfVector';

// Konva cannot render in jsdom, so the bitmap fallback is stubbed with a real 1×1 PNG
vi.mock('./raster', () => ({
  renderSlideToDataUrl: () =>
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
}));

/** Vector PDF channel: what stays text, what falls back to bitmap (P1-4) */

/**
 * Text a reader would see. pdf-lib flate-compresses content streams and encodes glyphs as hex
 * strings (`<...> Tj`), so raw bytes never contain the literal text; inflate, then decode.
 */
function extractPdfText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes);
  const contentStreams: string[] = [];
  for (let index = 0; index < raw.length - 1; index += 1) {
    if (raw[index] !== 0x78) continue;
    if (![0x01, 0x5e, 0x9c, 0xda].includes(raw[index + 1])) continue;
    try {
      contentStreams.push(inflateSync(raw.subarray(index)).toString('latin1'));
    } catch {
      // Not a zlib stream start, keep scanning
    }
  }
  let text = '';
  for (const match of contentStreams.join('\n').matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
    text += Buffer.from(match[1], 'hex').toString('latin1');
  }
  return text;
}

function docWithText(text = 'Hello World'): SlideDoc {
  const doc = createDoc('vector');
  const element = createTextElement(doc, text);
  element.x = 100;
  element.y = 80;
  element.width = 400;
  element.height = 120;
  doc.slides[0].elements.push(element);
  return doc;
}

describe('isEncodableText', () => {
  it('accepts Latin text and WinAnsi punctuation', () => {
    expect(isEncodableText('Hello World')).toBe(true);
    expect(isEncodableText('Café — “quoted” €')).toBe(true);
  });

  it('rejects CJK and symbols outside WinAnsi', () => {
    expect(isEncodableText('季度报告')).toBe(false);
    expect(isEncodableText('Hello 世界')).toBe(false);
    expect(isEncodableText('①')).toBe(false);
  });
});

describe('elementIsVectorSafe', () => {
  it('accepts plain text and solid shapes', () => {
    const doc = docWithText();
    expect(elementIsVectorSafe(doc.slides[0].elements[0])).toBe(true);

    const rect = createShapeElement(doc, { kind: 'rect', prst: 'rect' });
    expect(elementIsVectorSafe(rect)).toBe(true);
  });

  it('rejects rotated, shadowed and CJK content', () => {
    const doc = docWithText('中文标题');
    expect(elementIsVectorSafe(doc.slides[0].elements[0])).toBe(false);

    const rotated = createTextElement(doc, 'Rotated');
    rotated.rotation = 15;
    expect(elementIsVectorSafe(rotated)).toBe(false);

    const shadowed = createTextElement(doc, 'Shadow');
    shadowed.shadow = { color: '#000000', blur: 4, offsetX: 1, offsetY: 1, opacity: 0.4 };
    expect(elementIsVectorSafe(shadowed)).toBe(false);
  });

  it('rejects arrows and images', () => {
    const line: LineElement = {
      id: 'l1',
      type: 'line',
      x: 0,
      y: 0,
      width: 100,
      height: 0,
      points: [0, 0, 100, 0],
      stroke: { color: '#000000', width: 2 },
      tail: 'arrow',
    };
    expect(elementIsVectorSafe(line)).toBe(false);
    expect(elementIsVectorSafe({ ...line, tail: 'none' })).toBe(true);

    const image = {
      id: 'i1',
      type: 'image' as const,
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      mediaId: 'm1',
    };
    expect(elementIsVectorSafe(image)).toBe(false);
  });
});

describe('slideIsVectorSafe', () => {
  it('accepts a text-only slide and rejects gradient backgrounds', () => {
    const doc = docWithText();
    expect(slideIsVectorSafe(doc, doc.slides[0])).toBe(true);

    const gradientDoc = docWithText();
    gradientDoc.slides[0].background = {
      type: 'gradient',
      stops: [
        { offset: 0, color: '#FFFFFF' },
        { offset: 1, color: '#000000' },
      ],
    };
    expect(slideIsVectorSafe(gradientDoc, gradientDoc.slides[0])).toBe(false);
  });

  it('rejects slides that inherit layout elements', () => {
    const doc = docWithText();
    const layout = doc.layouts.find((item) => item.id === doc.slides[0].layoutId);
    layout?.elements.push(createTextElement(doc, 'Footer'));
    expect(slideIsVectorSafe(doc, doc.slides[0])).toBe(false);
  });
});

describe('exportSlidesToVectorPdf', () => {
  it('writes a searchable text page', async () => {
    const doc = docWithText('Quarterly Report');
    const result = await exportSlidesToVectorPdf(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.vectorPages).toBe(1);
    expect(result.value.rasterPages).toBe(0);
    const text = Buffer.from(result.value.bytes).toString('latin1');
    expect(text.startsWith('%PDF')).toBe(true);
    expect(extractPdfText(result.value.bytes)).toContain('Quarterly Report');
  });

  it('rasterises pages whose text is not encodable, and still returns a PDF', async () => {
    const doc = docWithText('季度报告');
    const result = await exportSlidesToVectorPdf(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.vectorPages).toBe(0);
    expect(result.value.rasterPages).toBe(1);
    expect((await PDFDocument.load(result.value.bytes)).getPageCount()).toBe(1);
    // A bitmap page carries no text operators, so nothing on it can be searched
    expect(extractPdfText(result.value.bytes)).toBe('');
  });

  it('keeps the vector pages searchable when other pages fall back', async () => {
    const doc = docWithText('Quarterly Report');
    const cjk = createTextElement(doc, '季度报告');
    doc.slides.push({ id: 'slide-2', layoutId: doc.slides[0].layoutId, elements: [cjk] });

    const result = await exportSlidesToVectorPdf(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.vectorPages).toBe(1);
    expect(result.value.rasterPages).toBe(1);
    expect((await PDFDocument.load(result.value.bytes)).getPageCount()).toBe(2);
    expect(extractPdfText(result.value.bytes)).toContain('Quarterly Report');
  });

  it('exports a ten-slide text deck with every page searchable', async () => {
    const doc = createDoc('ten');
    const layoutId = doc.slides[0].layoutId;
    doc.slides.length = 0;
    for (let index = 1; index <= 10; index += 1) {
      const element = createTextElement(doc, `Chapter ${index}`);
      element.width = 500;
      element.height = 100;
      doc.slides.push({ id: `slide-${index}`, layoutId, elements: [element] });
    }

    const result = await exportSlidesToVectorPdf(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.vectorPages).toBe(10);
    expect(result.value.rasterPages).toBe(0);
    expect((await PDFDocument.load(result.value.bytes)).getPageCount()).toBe(10);
    const text = extractPdfText(result.value.bytes);
    for (let index = 1; index <= 10; index += 1) expect(text).toContain(`Chapter ${index}`);
  });

  it('rejects an empty deck', async () => {
    const doc: SlideDoc = { ...createDoc('empty'), slides: [] };
    const result = await exportSlidesToVectorPdf(doc);
    expect(result.ok).toBe(false);
  });
});
