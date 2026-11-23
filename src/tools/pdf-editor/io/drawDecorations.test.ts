import { PDFDocument, StandardFonts, degrees } from '@cantoo/pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PAGE_NUMBERS, DEFAULT_WATERMARK } from '../model/decorations';
import {
  approximateTextWidth,
  drawPageDecorations,
  lineBaseline,
  lineX,
  positionAlign,
  positionEdge,
} from './drawDecorations';

describe('位置映射', () => {
  it('页码位置决定边与对齐', () => {
    expect(positionEdge('top-center')).toBe('top');
    expect(positionEdge('bottom-center')).toBe('bottom');
    expect(positionAlign('bottom-left')).toBe('left');
    expect(positionAlign('bottom-right')).toBe('right');
    expect(positionAlign('top-center')).toBe('center');
    expect(positionAlign('bottom-center')).toBe('center');
  });
});

describe('lineBaseline / lineX', () => {
  it('底部基线等于边距，顶部基线让文本框贴住上边距', () => {
    expect(lineBaseline(842, 10, 24, 'bottom')).toBe(24);
    expect(lineBaseline(842, 10, 24, 'top')).toBe(842 - 24 - 10);
  });

  it('左/中/右三种对齐都在页面内', () => {
    expect(lineX(600, 100, 'left', 30)).toBe(30);
    expect(lineX(600, 100, 'center', 30)).toBe(250);
    expect(lineX(600, 100, 'right', 30)).toBe(470);
  });
});

describe('approximateTextWidth', () => {
  it('CJK 按全角、拉丁按 0.55em 估算', () => {
    expect(approximateTextWidth('AB', 10)).toBeCloseTo(11);
    expect(approximateTextWidth('机密', 10)).toBeCloseTo(20);
    expect(approximateTextWidth('机密A', 10)).toBeCloseTo(25.5);
  });
});

describe('drawPageDecorations', () => {
  const makeDoc = async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]);
    const fonts = {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
      italic: await doc.embedFont(StandardFonts.HelveticaOblique),
      boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
    };
    return { out: doc, page, fonts };
  };

  it('没有装饰时不写内容流', async () => {
    const ctx = await makeDoc();
    const result = await drawPageDecorations(ctx, {
      decoration: undefined,
      index: 0,
      total: 1,
    });
    expect(result.rasterized).toBe(false);
    expect(ctx.page.node.Contents()).toBeUndefined();
  });

  it('页码 + 页眉 + 水印写入内容流，ASCII 不需要栅格', async () => {
    const ctx = await makeDoc();
    const result = await drawPageDecorations(ctx, {
      decoration: {
        numbers: { ...DEFAULT_PAGE_NUMBERS, enabled: true },
        header: {
          text: 'Quarterly report',
          align: 'center',
          fontSize: 9,
          color: '#444444',
          margin: 28,
        },
        watermark: { ...DEFAULT_WATERMARK, text: 'DRAFT', tiled: true },
      },
      index: 0,
      total: 3,
    });
    expect(result.rasterized).toBe(false);
    expect(ctx.page.node.Contents()).toBeTruthy();
  });

  it('旋转页也走视觉坐标：绘制不抛错且内容流存在', async () => {
    const ctx = await makeDoc();
    ctx.page.setRotation(degrees(90));
    const result = await drawPageDecorations(ctx, {
      decoration: { numbers: { ...DEFAULT_PAGE_NUMBERS, enabled: true } },
      index: 1,
      total: 2,
    });
    expect(result.rasterized).toBe(false);
    expect(ctx.page.node.Contents()).toBeTruthy();
  });

  it('CJK 水印在无 canvas 环境下静默跳过，不阻断保存', async () => {
    // jsdom 没有 canvas 实现；显式返回 null，避免 jsdom 往控制台打 "Not implemented"
    const spy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null as unknown as CanvasRenderingContext2D);

    try {
      const ctx = await makeDoc();
      const result = await drawPageDecorations(ctx, {
        decoration: { watermark: { ...DEFAULT_WATERMARK, text: '机密' } },
        index: 0,
        total: 1,
      });
      expect(result.rasterized).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});
