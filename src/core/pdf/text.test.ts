import { beforeAll, describe, expect, it } from 'vitest';
import { PDFDocument, rgb } from '@cantoo/pdf-lib';
import { addHeaderFooter } from './draw';
import { embedRasterizedText, needsUnicodeFont } from './text';

/** jsdom 无 2d 上下文：为中文栅格路径提供最小 mock（真实浏览器走系统字体）。 */
beforeAll(() => {
  const proto = HTMLCanvasElement.prototype;
  proto.getContext = ((type: string) => {
    if (type !== '2d') return null;
    return {
      font: '',
      fillStyle: '',
      textBaseline: 'top',
      measureText: (t: string) => ({ width: [...t].length * 14 }),
      fillText: () => undefined,
    } as unknown as CanvasRenderingContext2D;
  }) as typeof proto.getContext;
  // 1×1 PNG
  proto.toDataURL = () =>
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
});

describe('needsUnicodeFont', () => {
  it('detects CJK', () => {
    expect(needsUnicodeFont('Hello')).toBe(false);
    expect(needsUnicodeFont('页眉')).toBe(true);
    expect(needsUnicodeFont('Page 1 · 摘要')).toBe(true);
  });
});

describe('Chinese header/footer', () => {
  it('rasterizes unicode text instead of Helvetica "?"', async () => {
    const raster = await embedRasterizedText(
      await PDFDocument.create(),
      '中文页眉',
      12,
      rgb(0.2, 0.2, 0.2),
    );
    expect(raster.width).toBeGreaterThan(10);
    expect(raster.height).toBeGreaterThan(8);
  });

  it('embeds Chinese header without failing', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 600]);
    const r = await addHeaderFooter(doc, {
      header: '机密文档',
      footer: '仅供内部使用',
      fontSize: 11,
      align: 'center',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.byteLength).toBeGreaterThan(800);
  });
});
