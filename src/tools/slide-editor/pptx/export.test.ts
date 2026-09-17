import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  createDoc,
  createShapeElement,
  createTableElement,
  createTextElement,
} from '../model/factory';
import type { SlideDoc, SlideElement, TextElement } from '../model/types';
import { importPptxFile } from './import';
import { exportPptx } from './export';
import { elementXml, slideXml } from './write';

function sampleDoc(): SlideDoc {
  const doc = createDoc('demo');
  const text = createTextElement(doc, 'Hello 幻灯片') as TextElement;
  text.x = 80;
  text.y = 60;
  text.width = 400;
  text.height = 80;
  const shape = createShapeElement(doc, { kind: 'rect', prst: 'roundRect', radius: 0.167 });
  const table = createTableElement(doc, 2, 2);
  doc.slides[0].elements = [text, shape, table];
  doc.slides[0].background = '#F2F2F2';
  return doc;
}

async function exported(): Promise<{ bytes: Uint8Array; zip: JSZip }> {
  const result = await exportPptx(sampleDoc());
  expect(result.ok).toBe(true);
  const bytes = (result as { ok: true; value: Uint8Array }).value;
  return { bytes, zip: await JSZip.loadAsync(bytes) };
}

describe('pptx 导出包结构', () => {
  it('产出最小可用 OPC 集合', async () => {
    const { zip } = await exported();
    expect(zip.file('[Content_Types].xml')).not.toBeNull();
    expect(zip.file('_rels/.rels')).not.toBeNull();
    expect(zip.file('ppt/presentation.xml')).not.toBeNull();
    expect(zip.file('ppt/_rels/presentation.xml.rels')).not.toBeNull();
    expect(zip.file('ppt/theme/theme1.xml')).not.toBeNull();
    expect(zip.file('ppt/slideMasters/slideMaster1.xml')).not.toBeNull();
    expect(zip.file('ppt/slideLayouts/slideLayout1.xml')).not.toBeNull();
    expect(zip.file('ppt/slides/slide1.xml')).not.toBeNull();
    expect(zip.file('ppt/slides/_rels/slide1.xml.rels')).not.toBeNull();
  });

  it('Content_Types 覆盖每一页 / master / layout / theme', async () => {
    const { zip } = await exported();
    const xml = (await zip.file('[Content_Types].xml')?.async('string')) ?? '';
    expect(xml).toContain('/ppt/slides/slide1.xml');
    expect(xml).toContain('/ppt/slideMasters/slideMaster1.xml');
    expect(xml).toContain('/ppt/slideLayouts/slideLayout1.xml');
    expect(xml).toContain('/ppt/theme/theme1.xml');
  });

  it('presentation rels 与 sldIdLst 的 rId 一一对应', async () => {
    const { zip } = await exported();
    const rels = (await zip.file('ppt/_rels/presentation.xml.rels')?.async('string')) ?? '';
    const presentation = (await zip.file('ppt/presentation.xml')?.async('string')) ?? '';
    expect(rels).toContain('Target="slides/slide1.xml"');
    expect(rels).toContain('Id="rId2"');
    expect(presentation).toContain('r:id="rId2"');
  });
});

describe('DrawingML 元素顺序（PowerPoint 不允许乱序）', () => {
  it('p:sp 内 nvSpPr → spPr → txBody 顺序正确', () => {
    const doc = createDoc('seq');
    const text = createTextElement(doc, 'order') as TextElement;
    const xml = slideXml([text], new Map());
    const nv = xml.indexOf('<p:nvSpPr>');
    const spPr = xml.indexOf('<p:spPr>');
    const txBody = xml.indexOf('<p:txBody>');
    expect(nv).toBeGreaterThan(-1);
    expect(spPr).toBeGreaterThan(nv);
    expect(txBody).toBeGreaterThan(spPr);
  });

  it('p:spPr 内先几何后填充再描边', () => {
    const doc = createDoc('seq2');
    const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' });
    const xml = elementXml(shape as SlideElement, new Map());
    expect(xml.indexOf('prstGeom')).toBeLessThan(xml.indexOf('solidFill'));
    expect(xml.indexOf('solidFill')).toBeLessThan(xml.indexOf('<a:ln '));
  });

  it('表格 txBody 早于 tcPr', () => {
    const doc = createDoc('tbl');
    const table = createTableElement(doc, 1, 1);
    const xml = elementXml(table, new Map());
    expect(xml.indexOf('<a:tc>')).toBeGreaterThan(-1);
    expect(xml.indexOf('txBody')).toBeLessThan(xml.indexOf('tcPr'));
  });
});

describe('往返一致性', () => {
  it('导出的 pptx 能被重新导入且元素数量一致', async () => {
    const { bytes } = await exported();
    const file = new File([bytes], 'roundtrip.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
    const result = await importPptxFile(file);
    expect(result.ok).toBe(true);
    const value = (result as { ok: true; value: { doc: SlideDoc } }).value;
    expect(value.doc.slides).toHaveLength(1);
    expect(value.doc.slides[0].elements.length).toBeGreaterThanOrEqual(2);
    expect(value.doc.width).toBeGreaterThan(0);
  });

  it('保留文本内容', async () => {
    const { bytes } = await exported();
    const file = new File([bytes], 'text.pptx');
    const result = await importPptxFile(file);
    expect(result.ok).toBe(true);
    const doc = (result as { ok: true; value: { doc: SlideDoc } }).value.doc;
    const allText = doc.slides[0].elements
      .map((element) =>
        element.type === 'text'
          ? element.body.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n')
          : '',
      )
      .join('');
    expect(allText).toContain('Hello 幻灯片');
  });
});
