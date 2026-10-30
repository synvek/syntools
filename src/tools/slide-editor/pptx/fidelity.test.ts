import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  createDoc,
  createShapeElement,
  createTableElement,
  createTextElement,
} from '../model/factory';
import type { ShapeElement, SlideDoc, TableElement, TextElement } from '../model/types';
// These assert the hand-written channel (explicit DrawingML), so legacy is requested on purpose.
import { exportPptxLegacy } from './export';
import { importPptxFile } from './import';

/**
 * Round-trip regressions for text / shape / table properties that the writer emitted (or the
 * model supported) while the reader silently dropped them — plus the unit mismatches that made
 * line spacing and paragraph spacing drift on every save/reopen.
 */

async function roundTrip(doc: SlideDoc): Promise<SlideDoc> {
  const exported = await exportPptxLegacy(doc);
  expect(exported.ok).toBe(true);
  if (!exported.ok) throw new Error(exported.error);
  const imported = await importPptxFile(new File([exported.value], 'fidelity.pptx'));
  expect(imported.ok).toBe(true);
  if (!imported.ok) throw new Error(imported.error);
  return imported.value.doc;
}

function textDoc(configure: (text: TextElement) => void): SlideDoc {
  const doc = createDoc('fidelity');
  const text = createTextElement(doc, 'Spacing sample') as TextElement;
  text.x = 80;
  text.y = 60;
  text.width = 400;
  text.height = 120;
  configure(text);
  doc.slides[0].elements = [text];
  return doc;
}

async function firstElement(
  doc: SlideDoc,
): Promise<SlideDoc['slides'][number]['elements'][number]> {
  const back = await roundTrip(doc);
  const element = back.slides[0].elements[0];
  expect(element).toBeDefined();
  return element as SlideDoc['slides'][number]['elements'][number];
}

describe('段落间距（单位：spcPct 1/1000 %，spcPts 1/100 pt）', () => {
  it('导出写的是规范单位', async () => {
    const doc = textDoc((text) => {
      text.body.paragraphs[0] = {
        ...text.body.paragraphs[0],
        lineSpacing: 1.5,
        spaceBefore: 12,
        spaceAfter: 9,
      };
    });
    const exported = await exportPptxLegacy(doc);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const zip = await JSZip.loadAsync(exported.value);
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    // 150% line spacing, not 1.5%
    expect(xml).toContain('<a:spcPct val="150000"/>');
    // 12px = 9pt = 900 hundredths of a point
    expect(xml).toContain('<a:spcPts val="900"/>');
    expect(xml).toContain('<a:spcPts val="675"/>');
  });

  it('行距 / 段前 / 段后往返后保持', async () => {
    const doc = textDoc((text) => {
      text.body.paragraphs[0] = {
        ...text.body.paragraphs[0],
        lineSpacing: 1.5,
        spaceBefore: 12,
        spaceAfter: 8,
      };
    });
    const element = (await firstElement(doc)) as TextElement;
    expect(element.type).toBe('text');
    const paragraph = element.body.paragraphs[0];
    expect(paragraph.lineSpacing).toBeCloseTo(1.5, 3);
    expect(paragraph.spaceBefore).toBeCloseTo(12, 3);
    expect(paragraph.spaceAfter).toBeCloseTo(8, 3);
  });
});

describe('文本框 bodyPr', () => {
  it('autoFit 往返保持（normAutofit / spAutoFit 都识别）', async () => {
    const element = (await firstElement(
      textDoc((text) => {
        text.body.autoFit = 'autofit';
      }),
    )) as TextElement;
    expect(element.body.autoFit).toBe('autofit');
  });

  it('竖向排版 vert 往返保持', async () => {
    const element = (await firstElement(
      textDoc((text) => {
        text.body.vert = 'vert270';
      }),
    )) as TextElement;
    expect(element.body.vert).toBe('vert270');
  });

  it('圆角文本框走 roundRect + adj1 并还原 cornerRadius', async () => {
    const doc = textDoc((text) => {
      text.cornerRadius = 18;
    });
    const exported = await exportPptxLegacy(doc);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const zip = await JSZip.loadAsync(exported.value);
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    expect(xml).toContain('<a:prstGeom prst="roundRect">');
    // 18 / min(400, 120) = 0.15
    expect(xml).toContain('fmla="val 15000"');

    const element = (await firstElement(doc)) as TextElement;
    expect(element.type).toBe('text');
    expect(element.cornerRadius).toBe(18);
  });
});

describe('run 级属性', () => {
  it('字距 / 上下标 / 高亮往返保持', async () => {
    const element = (await firstElement(
      textDoc((text) => {
        text.body.paragraphs[0].runs = [
          { text: 'sup', style: { spacing: 1.5, baseline: 30000, highlight: '#FFF2CC' } },
          { text: 'sub', style: { baseline: -25000 } },
        ];
      }),
    )) as TextElement;
    const [sup, sub] = element.body.paragraphs[0].runs;
    expect(sup?.style?.spacing).toBeCloseTo(1.5, 3);
    expect(sup?.style?.baseline).toBe(30000);
    // The reader normalises every colour through normalizeHex (#rrggbb)
    expect(sup?.style?.highlight?.toUpperCase()).toBe('#FFF2CC');
    expect(sub?.style?.baseline).toBe(-25000);
  });
});

describe('形状描边', () => {
  it('虚线样式往返保持', async () => {
    const doc = createDoc('dash');
    const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' }) as ShapeElement;
    shape.stroke = { color: '#112233', width: 2, dash: [8, 4] };
    doc.slides[0].elements = [shape];

    const element = (await firstElement(doc)) as ShapeElement;
    expect(element.type).toBe('shape');
    expect(element.stroke?.dash).toEqual([8, 4]);
  });
});

describe('表格', () => {
  function tableDoc(): SlideDoc {
    const doc = createDoc('table-fidelity');
    const table = createTableElement(doc, 2, 2) as TableElement;
    table.borderColor = '#123456';
    table.rows[0][0] = {
      ...table.rows[0][0],
      text: 'A1',
      fill: '#1F3864',
      color: '#FFFFFF',
      bold: true,
    };
    table.rows[0][1] = { ...table.rows[0][1], text: 'B1', fill: '#FFF2CC' };
    doc.slides[0].elements = [table];
    return doc;
  }

  it('单元格底色与边框色写进 a:tcPr（顺序：边框 → 填充）', async () => {
    const exported = await exportPptxLegacy(tableDoc());
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const zip = await JSZip.loadAsync(exported.value);
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    expect(xml).toContain('<a:lnL w="12700"');
    expect(xml).toContain('<a:srgbClr val="123456"/>');
    expect(xml).toContain('<a:srgbClr val="1F3864"/>');
    expect(xml.indexOf('<a:lnL')).toBeLessThan(xml.indexOf('val="1F3864"'));
  });

  it('单元格底色与表格边框色往返保持', async () => {
    const element = (await firstElement(tableDoc())) as TableElement;
    expect(element.type).toBe('table');
    expect(element.rows[0][0].fill?.toUpperCase()).toBe('#1F3864');
    expect(element.rows[0][1].fill?.toUpperCase()).toBe('#FFF2CC');
    expect(element.borderColor?.toUpperCase()).toBe('#123456');
    expect(element.rows[0][0].bold).toBe(true);
  });
});
