import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDoc, createImageElement, createShapeElement } from '../model/factory';
import type { MediaAsset, ShapeElement, SlideDoc } from '../model/types';
import { exportPptx } from './export';
import { importPptxFile } from './import';
import { slideXml } from './write';

/**
 * P2-S4.2 picture fill (`a:blipFill`).
 *
 * A picture fill is not just markup: the picture is a **package part plus a slide relationship**.
 * The failure modes this pins down are all silent otherwise:
 * 1. the fill is written but the media part is missing → PowerPoint reports a repair;
 * 2. the media part is written but no relationship → the shape shows an empty frame;
 * 3. an `r:embed` pointing nowhere (asset deleted) → repair prompt again;
 * 4. pptxgenjs cannot express a picture fill at all, so the document must switch channels.
 */

// 1×1 transparent PNG
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF+p0hRAAAAAElFTkSuQmCC',
  ),
  (char) => char.charCodeAt(0),
);

/**
 * jsdom cannot decode images, so `measureImageSize` would fail and every imported picture would be
 * dropped. A 2×2 stand-in keeps the import path (blip → media part → MediaAsset) under test.
 */
class FakeImage {
  naturalWidth = 2;
  naturalHeight = 2;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

beforeEach(() => {
  vi.stubGlobal('Image', FakeImage as unknown as typeof Image);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const mediaAsset = (id: string): MediaAsset => ({
  id,
  mime: 'image/png',
  bytes: PNG,
  width: 2,
  height: 2,
});

const docWith = (fill: ShapeElement['fill']): ShapeDoc => {
  const doc = createDoc('picture-fill');
  const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' }) as ShapeElement;
  shape.fill = fill;
  doc.slides[0].elements = [shape];
  doc.media = { media1: mediaAsset('media1') };
  return doc;
};

type ShapeDoc = SlideDoc;

const fileOf = (bytes: Uint8Array, name: string): File => {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return { name, size: bytes.byteLength, arrayBuffer: async () => buffer } as unknown as File;
};

describe('a:blipFill 写出', () => {
  it('拉伸模式写 blipFill + stretch，并带上媒体关系', () => {
    const doc = docWith({ type: 'image', mediaId: 'media1', mode: 'stretch' });
    const xml = slideXml(doc.slides[0].elements, new Map([['media1', 'rId2']]));
    expect(xml).toContain('<a:blipFill rotWithShape="1">');
    expect(xml).toContain('<a:blip r:embed="rId2">');
    expect(xml).toContain('<a:stretch><a:fillRect/></a:stretch>');
    // A picture fill replaces the solid/gradient paint entirely
    expect(xml).not.toContain('<a:solidFill><a:srgbClr val="4472C4"');
  });

  it('平铺模式写 a:tile，缩放按千分之一百分比', () => {
    const doc = docWith({ type: 'image', mediaId: 'media1', mode: 'tile', scale: 50 });
    const xml = slideXml(doc.slides[0].elements, new Map([['media1', 'rId2']]));
    expect(xml).toContain('<a:tile tx="0" ty="0" sx="50000" sy="50000"');
    expect(xml).not.toContain('<a:stretch>');
  });

  it('拿不到媒体关系时退化为 noFill，不写悬空的 r:embed', () => {
    const doc = docWith({ type: 'image', mediaId: 'missing', mode: 'stretch' });
    const xml = slideXml(doc.slides[0].elements, new Map());
    expect(xml).not.toContain('r:embed');
    expect(xml).toContain('<a:noFill/>');
  });
});

describe('媒体打包', () => {
  it('图片填充的媒体会进包，并在 slide rels 里注册', async () => {
    const doc = docWith({ type: 'image', mediaId: 'media1', mode: 'stretch' });
    const exported = await exportPptx(doc);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const zip = await JSZip.loadAsync(exported.value);
    expect(zip.file('ppt/media/image1.png')).toBeTruthy();
    const rels = (await zip.file('ppt/slides/_rels/slide1.xml.rels')?.async('string')) ?? '';
    expect(rels).toContain('Target="../media/image1.png"');

    // 只有图片填充也会画一个 p:sp，不是 p:pic
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    expect(xml).toContain('<p:sp>');
    expect(xml).toContain('<a:blipFill');
    expect(xml).not.toContain('<p:pic>');
  });
});

describe('图片元素导入（relAttr 回归）', () => {
  /**
   * `r:embed` keeps its prefix in the parsed tree (`@_r:embed`), so `attr(blip, 'embed')` returns
   * undefined. Every picture imported from a real pptx therefore degraded into a "图片" placeholder
   * box — invisible in unit tests because no test ever imported a picture.
   */
  it('普通 p:pic 导入后仍是 image 元素，并带回媒体字节', async () => {
    const doc = createDoc('picture-element');
    const asset = mediaAsset('media1');
    doc.media = { media1: asset };
    doc.slides[0].elements = [createImageElement(doc, asset)];
    const exported = await exportPptx(doc);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const imported = await importPptxFile(fileOf(exported.value, 'pic.pptx'));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const element = imported.value.doc.slides[0].elements[0];
    expect(element?.type).toBe('image');
    const mediaId = element?.type === 'image' ? element.mediaId : '';
    expect(imported.value.doc.media[mediaId]?.bytes?.byteLength).toBe(PNG.byteLength);
  });
});

describe('往返', () => {
  it('导出后导入：模式、缩放与图片字节都保留', async () => {
    const doc = docWith({ type: 'image', mediaId: 'media1', mode: 'tile', scale: 40 });
    const exported = await exportPptx(doc);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const imported = await importPptxFile(fileOf(exported.value, 'picture.pptx'));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const element = imported.value.doc.slides[0].elements[0];
    const fill = element && 'fill' in element ? element.fill : undefined;
    expect(fill).toMatchObject({ type: 'image', mode: 'tile', scale: 40 });
    const mediaId = fill && fill.type === 'image' ? fill.mediaId : '';
    // 图片进了 doc.media，且指向包里的同一份字节
    const asset = imported.value.doc.media[mediaId];
    expect(asset?.bytes?.byteLength).toBe(PNG.byteLength);
  });
});
