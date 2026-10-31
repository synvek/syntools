import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { createDoc, createShapeElement, createTextElement } from '../model/factory';
import type { ShapeElement, SlideDoc, TextElement } from '../model/types';
import { exportPptx } from './export';
import { importPptxFile } from './import';
import { slideXml } from './write';

/**
 * P2-S4 pattern fill (`a:pattFill`).
 *
 * Three things are easy to break and are pinned here:
 * 1. **element order** — `fgClr` before `bgClr`, and the whole `pattFill` where a solid/gradient
 *    would sit in `a:spPr` (wrong position → PowerPoint ignores the fill silently);
 * 2. **channel routing** — pptxgenjs has no pattern fill and would degrade to the foreground colour
 *    without a warning, so a pattern must force the hand-written writer;
 * 3. **unknown presets** — PowerPoint ships ~50 pattern ids, ours covers 20; an unknown one must be
 *    downgraded on import instead of being written back verbatim.
 */

const fileOf = (bytes: Uint8Array, name: string): File => {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return { name, size: bytes.byteLength, arrayBuffer: async () => buffer } as unknown as File;
};

/** First element's fill, narrowed: pattern round-trips only ever touch shapes/text */
const fillOf = (doc: SlideDoc): unknown => {
  const element = doc.slides[0].elements[0];
  return element && 'fill' in element ? element.fill : undefined;
};

const shapeWithPattern = (doc: SlideDoc): ShapeElement => {
  const element = createShapeElement(doc, { kind: 'rect', prst: 'rect' }) as ShapeElement;
  element.fill = { type: 'pattern', prst: 'ltDnDiag', fgColor: '#1f3864', bgColor: '#ffffff' };
  doc.slides[0].elements = [element];
  return element;
};

describe('a:pattFill 写出', () => {
  it('图案填充写 prst + fgClr/bgClr，颜色大写、不带 #', () => {
    const doc = createDoc('pattern');
    const xml = slideXml([shapeWithPattern(doc)], new Map());
    expect(xml).toContain('<a:pattFill prst="ltDnDiag">');
    expect(xml).toContain('<a:fgClr><a:srgbClr val="1F3864">');
    expect(xml).toContain('<a:bgClr><a:srgbClr val="FFFFFF">');
    // fgClr must come first: the schema fixes the child order
    expect(xml.indexOf('<a:fgClr>')).toBeLessThan(xml.indexOf('<a:bgClr>'));
    expect(xml).not.toContain('<a:solidFill><a:srgbClr val="1F3864"/></a:solidFill>');
  });

  it('元素透明度按 alpha 同时压到两种墨色上', () => {
    const doc = createDoc('pattern-alpha');
    const shape = shapeWithPattern(doc);
    shape.opacity = 0.5;
    const xml = slideXml([shape], new Map());
    expect(xml).toContain('<a:fgClr><a:srgbClr val="1F3864"><a:alpha val="50000"/>');
    expect(xml).toContain('<a:bgClr><a:srgbClr val="FFFFFF"><a:alpha val="50000"/>');
  });

  it('文本框的底框同样支持图案', () => {
    const doc = createDoc('pattern-text');
    const text = createTextElement(doc, 'hi') as TextElement;
    text.fill = { type: 'pattern', prst: 'cross', fgColor: '#c00000', bgColor: '#ffffff' };
    doc.slides[0].elements = [text];
    expect(slideXml([text], new Map())).toContain('<a:pattFill prst="cross">');
  });
});

describe('图案往返与通道', () => {
  it('带图案的文档走手写通道，导出后可读回 prst 与两种墨色', async () => {
    const doc = createDoc('pattern-roundtrip');
    shapeWithPattern(doc);

    const exported = await exportPptx(doc);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    // pptxgenjs 写不出 a:pattFill —— 出现它证明分派到手写通道了
    const zip = await JSZip.loadAsync(exported.value);
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    expect(xml).toContain('<a:pattFill prst="ltDnDiag">');

    const imported = await importPptxFile(fileOf(exported.value, 'pattern.pptx'));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(fillOf(imported.value.doc)).toEqual({
      type: 'pattern',
      prst: 'ltDnDiag',
      fgColor: '#1f3864',
      bgColor: '#ffffff',
    });
  });

  it('未知 prst 导入时降级为 pct20，而不是原样写回', async () => {
    // 直接构造一份 spPr，模拟 PowerPoint 里我们没收录的图案（smGrid 不在 20 种之内）
    const doc = createDoc('pattern-unknown');
    const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' }) as ShapeElement;
    shape.fill = { type: 'pattern', prst: 'pct20', fgColor: '#000000', bgColor: '#ffffff' };
    doc.slides[0].elements = [shape];
    const exported = await exportPptx(doc);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const zip = await JSZip.loadAsync(exported.value);
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    const patched = xml.replace('prst="pct20"', 'prst="smGrid"');
    zip.file('ppt/slides/slide1.xml', patched);
    const bytes = await zip.generateAsync({ type: 'uint8array' });

    const imported = await importPptxFile(fileOf(bytes, 'unknown.pptx'));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    const fill = fillOf(imported.value.doc);
    expect(fill).toMatchObject({ type: 'pattern', prst: 'pct20' });
  });
});
