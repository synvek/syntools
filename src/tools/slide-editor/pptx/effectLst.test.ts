import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { createDoc, createShapeElement, createTextElement } from '../model/factory';
import type { ShapeElement, SlideDoc } from '../model/types';
import { exportPptx } from './export';
import { importPptxFile } from './import';
import { slideXml } from './write';
import { EMU_PER_PX } from '../../../core/drawing/geometry';

/**
 * P2-S3.1: `a:effectLst` for glow + outer shadow.
 *
 * Two things are easy to get wrong and are pinned here:
 * 1. **child order** — the schema fixes it (glow before outerShdw), PowerPoint rejects/ignores
 *    effect lists in the wrong order while still opening the file;
 * 2. **channel routing** — pptxgenjs can only express one shadow, so a glow must force the
 *    hand-written writer instead of silently disappearing.
 */

const fileOf = (bytes: Uint8Array, name: string): File => {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return { name, size: bytes.byteLength, arrayBuffer: async () => buffer } as unknown as File;
};

const shapeWith = (doc: SlideDoc, effects: Partial<ShapeElement>): ShapeElement => {
  const element = createShapeElement(doc, { kind: 'rect', prst: 'rect' }) as ShapeElement;
  Object.assign(element, effects);
  doc.slides[0].elements = [element];
  return element;
};

describe('effectLst 写出', () => {
  it('只有光晕时只写 a:glow，半径转成 EMU', () => {
    const doc = createDoc('glow');
    const shape = shapeWith(doc, { glow: { color: '#38bdf8', radius: 10, opacity: 0.5 } });
    const xml = slideXml([shape], new Map());
    expect(xml).toContain(`<a:glow rad="${10 * EMU_PER_PX}">`);
    expect(xml).toContain('<a:srgbClr val="38BDF8"><a:alpha val="50000"/></a:srgbClr>');
    expect(xml).not.toContain('<a:outerShdw');
  });

  it('光晕与阴影同时存在时，glow 必须在 outerShdw 之前', () => {
    const doc = createDoc('both');
    const shape = shapeWith(doc, {
      glow: { color: '#38bdf8', radius: 8 },
      shadow: { color: '#000000', blur: 4, offsetX: 2, offsetY: 2 },
    });
    const xml = slideXml([shape], new Map());
    const glow = xml.indexOf('<a:glow');
    const shadow = xml.indexOf('<a:outerShdw');
    expect(glow).toBeGreaterThan(-1);
    expect(shadow).toBeGreaterThan(glow);
    expect(xml.match(/<a:effectLst>/g)).toHaveLength(1);
  });

  it('柔化写 a:softEdge，且排在所有阴影之后（schema 顺序）', () => {
    const doc = createDoc('soft');
    const shape = shapeWith(doc, {
      softEdge: { radius: 7 },
      shadow: { color: '#000000', blur: 4, offsetX: 2, offsetY: 2 },
    });
    const xml = slideXml([shape], new Map());
    expect(xml).toContain(`<a:softEdge rad="${7 * EMU_PER_PX}"/>`);
    const shadowAt = xml.indexOf('<a:outerShdw');
    const softAt = xml.indexOf('<a:softEdge');
    expect(shadowAt).toBeGreaterThan(-1);
    expect(softAt).toBeGreaterThan(shadowAt);
  });

  it('没有效果时不写 effectLst', () => {
    const doc = createDoc('plain');
    const shape = shapeWith(doc, {});
    expect(slideXml([shape], new Map())).not.toContain('<a:effectLst');
  });

  it('文本框的 spPr 同样带效果', () => {
    const doc = createDoc('text');
    const text = createTextElement(doc, 'hi');
    text.glow = { color: '#FF0000', radius: 6 };
    doc.slides[0].elements = [text];
    expect(slideXml([text], new Map())).toContain('<a:glow rad=');
  });
});

describe('往返与通道', () => {
  it('带光晕的文档走手写通道，导出后可读回', async () => {
    const doc = createDoc('roundtrip');
    shapeWith(doc, { glow: { color: '#38bdf8', radius: 12, opacity: 0.75 } });

    const exported = await exportPptx(doc);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    // pptxgenjs 写不出 a:glow —— 出现它证明分派到手写通道了
    const zip = await JSZip.loadAsync(exported.value);
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    expect(xml).toContain(`<a:glow rad="${12 * EMU_PER_PX}">`);

    const imported = await importPptxFile(fileOf(exported.value, 'glow.pptx'));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    const element = imported.value.doc.slides[0].elements[0];
    expect(element?.glow).toEqual({ color: '#38bdf8', radius: 12, opacity: 0.75 });
    // 形状的几何不能被效果影响
    expect(element?.type).toBe('shape');
  });

  it('柔化往返：rad 读回为 px，rad=0 被丢弃', async () => {
    const doc = createDoc('soft-roundtrip');
    shapeWith(doc, { softEdge: { radius: 15 } });
    const exported = await exportPptx(doc);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const zip = await JSZip.loadAsync(exported.value);
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    expect(xml).toContain('<a:softEdge');

    const imported = await importPptxFile(fileOf(exported.value, 'soft.pptx'));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value.doc.slides[0].elements[0]?.softEdge).toEqual({ radius: 15 });

    const zero = createDoc('soft-zero');
    shapeWith(zero, { softEdge: { radius: 0 } });
    const zeroExported = await exportPptx(zero);
    expect(zeroExported.ok).toBe(true);
    if (!zeroExported.ok) return;
    const zeroImported = await importPptxFile(fileOf(zeroExported.value, 'zero-soft.pptx'));
    expect(zeroImported.ok).toBe(true);
    if (!zeroImported.ok) return;
    expect(zeroImported.value.doc.slides[0].elements[0]?.softEdge).toBeUndefined();
  });

  it('导入时 rad=0 的 a:glow 被丢弃（否则会一直导出一个空效果）', async () => {
    const doc = createDoc('zero');
    shapeWith(doc, { glow: { color: '#38bdf8', radius: 0 } });
    const exported = await exportPptx(doc);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const imported = await importPptxFile(fileOf(exported.value, 'zero.pptx'));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value.doc.slides[0].elements[0]?.glow).toBeUndefined();
  });
});
