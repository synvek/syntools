import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  createDoc,
  createLineElement,
  createShapeElement,
  createTableElement,
  createTextElement,
} from '../model/factory';
import type { SlideDoc, SlideElement, TextElement } from '../model/types';
import { importPptxFile } from './import';
// 本文件断言的是**自研 DrawingML 通道**的输出结构，因此显式走 legacy。
// pptxgen 通道的断言见 exportPptxgen.test.ts。
import { exportPptxLegacy } from './export';
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
  const result = await exportPptxLegacy(sampleDoc());
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

  it('slideMaster 不得包含非法的 clrMapOvr（否则 PowerPoint 提示修复）', async () => {
    const { zip } = await exported();
    const master = (await zip.file('ppt/slideMasters/slideMaster1.xml')?.async('string')) ?? '';
    expect(master).not.toContain('clrMapOvr');
  });

  it('spTree 的 nvGrpSpPr 必须包含必需的 cNvPr（否则提示修复）', async () => {
    const { zip } = await exported();
    for (const part of [
      'ppt/slides/slide1.xml',
      'ppt/slideMasters/slideMaster1.xml',
      'ppt/slideLayouts/slideLayout1.xml',
    ]) {
      const xml = (await zip.file(part)?.async('string')) ?? '';
      expect(xml).toMatch(/<p:nvGrpSpPr><p:cNvPr id="1"[^>]*>/);
    }
  });

  it('不得出现 DrawingML 中不存在的 omitArrowheads（否则提示修复）', async () => {
    const { zip } = await exported();
    const files = Object.keys(zip.files).filter((f) => f.endsWith('.xml'));
    for (const f of files) {
      const xml = (await zip.file(f)?.async('string')) ?? '';
      expect(xml).not.toContain('omitArrowheads');
    }
  });

  it('connector（线条）的 nvCxnSpPr 必须包含 cNvPr', async () => {
    const doc = createDoc('line');
    doc.slides[0].elements = [createLineElement(doc)];
    const result = await exportPptxLegacy(doc);
    expect(result.ok).toBe(true);
    const bytes = (result as { ok: true; value: Uint8Array }).value;
    const zip = await JSZip.loadAsync(bytes);
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    expect(xml).toMatch(/<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="\d+"[^>]*>/);
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

describe('母版 / 版式 / 备注保真', () => {
  it('母版元素被写回 spTree，而不是只写空母版', async () => {
    const doc = sampleDoc();
    doc.masters[0].elements = [createTextElement(doc, '母版页脚')];
    const result = await exportPptxLegacy(doc);
    const zip = await JSZip.loadAsync((result as { ok: true; value: Uint8Array }).value);
    const master = (await zip.file('ppt/slideMasters/slideMaster1.xml')?.async('string')) ?? '';
    expect(master).toContain('母版页脚');
  });

  it('版式内容被写回，且 rels 指向正确的母版', async () => {
    const doc = sampleDoc();
    doc.layouts[0].name = 'Title and Content';
    doc.layouts[0].elements = [createTextElement(doc, '版式占位')];
    const result = await exportPptxLegacy(doc);
    const zip = await JSZip.loadAsync((result as { ok: true; value: Uint8Array }).value);
    const layout = (await zip.file('ppt/slideLayouts/slideLayout1.xml')?.async('string')) ?? '';
    expect(layout).toContain('版式占位');
    expect(layout).toContain('Title and Content');
    const rels =
      (await zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels')?.async('string')) ?? '';
    expect(rels).toContain('../slideMasters/slideMaster1.xml');
  });

  it('含备注的页会写出 notesSlide 部件与关系，并能往返导入', async () => {
    const doc = sampleDoc();
    doc.slides[0].notes = '开场先讲背景\n再讲结论';
    const result = await exportPptxLegacy(doc);
    const bytes = (result as { ok: true; value: Uint8Array }).value;
    const zip = await JSZip.loadAsync(bytes);

    const notes = (await zip.file('ppt/notesSlides/notesSlide1.xml')?.async('string')) ?? '';
    expect(notes).toContain('开场先讲背景');
    expect(notes).toContain('type="body" idx="1"');
    const rels =
      (await zip.file('ppt/notesSlides/_rels/notesSlide1.xml.rels')?.async('string')) ?? '';
    expect(rels).toContain('../slides/slide1.xml');
    const slideRels = (await zip.file('ppt/slides/_rels/slide1.xml.rels')?.async('string')) ?? '';
    expect(slideRels).toContain('notesSlide');
    const contentTypes = (await zip.file('[Content_Types].xml')?.async('string')) ?? '';
    expect(contentTypes).toContain('/ppt/notesSlides/notesSlide1.xml');

    const imported = await importPptxFile(new File([bytes], 'notes.pptx'));
    expect(imported.ok).toBe(true);
    const back = (imported as { ok: true; value: { doc: SlideDoc } }).value.doc;
    expect(back.slides[0].notes).toBe('开场先讲背景\n再讲结论');
  });

  it('无备注的页不产生 notesSlide 部件', async () => {
    const { zip } = await exported();
    expect(zip.file('ppt/notesSlides/notesSlide1.xml')).toBeNull();
  });

  it('多版式导出时每页 rels 指向自己的版式', async () => {
    const doc = sampleDoc();
    doc.layouts.push({
      id: 'layout-secondary',
      masterId: doc.masters[0].id,
      name: 'Section Header',
      elements: [],
    });
    doc.slides.push({
      id: 'slide-2',
      layoutId: 'layout-secondary',
      elements: [createTextElement(doc, '第二页')],
    });
    const result = await exportPptxLegacy(doc);
    const zip = await JSZip.loadAsync((result as { ok: true; value: Uint8Array }).value);
    expect(zip.file('ppt/slideLayouts/slideLayout2.xml')).not.toBeNull();
    const rels = (await zip.file('ppt/slides/_rels/slide2.xml.rels')?.async('string')) ?? '';
    expect(rels).toContain('../slideLayouts/slideLayout2.xml');
    const contentTypes = (await zip.file('[Content_Types].xml')?.async('string')) ?? '';
    expect(contentTypes).toContain('/ppt/slideLayouts/slideLayout2.xml');
  });
});

describe('合并单元格', () => {
  it('被覆盖的格子写成 hMerge/vMerge，且跨列格写 gridSpan', async () => {
    const doc = sampleDoc();
    const table = doc.slides[0].elements.find((element) => element.type === 'table');
    if (table?.type === 'table') {
      table.rows[0][0].colSpan = 2;
      table.rows[0][1] = { ...table.rows[0][1], covered: true, text: '' };
    }
    const result = await exportPptxLegacy(doc);
    const zip = await JSZip.loadAsync((result as { ok: true; value: Uint8Array }).value);
    const slide = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    // gridSpan 必须是 a:tc 的属性（写在 a:tcPr 上会被 PowerPoint 忽略）
    expect(slide).toContain('<a:tc gridSpan="2">');
    expect(slide).toContain('hMerge="1"');
    // 横向合并不应写成纵向覆盖
    expect(slide).not.toContain('vMerge="1"');
  });

  it('合并单元格往返后 colSpan / covered 保持', async () => {
    const doc = sampleDoc();
    const table = doc.slides[0].elements.find((element) => element.type === 'table');
    if (table?.type === 'table') {
      table.rows[0][0].colSpan = 2;
      table.rows[0][1] = { ...table.rows[0][1], covered: true, text: '' };
    }
    const result = await exportPptxLegacy(doc);
    const bytes = (result as { ok: true; value: Uint8Array }).value;
    const imported = await importPptxFile(new File([bytes], 'merge.pptx'));
    expect(imported.ok).toBe(true);
    const back = (imported as { ok: true; value: { doc: SlideDoc } }).value.doc;
    const backTable = back.slides[0].elements.find((element) => element.type === 'table');
    expect(backTable?.type).toBe('table');
    if (backTable?.type === 'table') {
      expect(backTable.rows[0][0].colSpan).toBe(2);
      expect(backTable.rows[0][1].covered).toBe(true);
    }
  });
});

describe('表格样式写回', () => {
  it('表头 / 斑马纹按元素设置写入，而非硬编码', async () => {
    const doc = sampleDoc();
    const table = doc.slides[0].elements.find((element) => element.type === 'table');
    if (table?.type === 'table') {
      table.headerRow = false;
      table.bandRow = true;
    }
    const result = await exportPptxLegacy(doc);
    const zip = await JSZip.loadAsync((result as { ok: true; value: Uint8Array }).value);
    const slide = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    expect(slide).not.toContain('firstRow="1"');
    expect(slide).toContain('bandRow="1"');
  });
});
