import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  createChartElement,
  createDoc,
  createLineElement,
  createShapeElement,
  createTableElement,
  createTextElement,
} from '../model/factory';
import type {
  ChartElement,
  GroupElement,
  ImageElement,
  LineElement,
  ShapeElement,
  SlideDoc,
  TableElement,
  TextElement,
} from '../model/types';
// These assert the hand-written channel (explicit DrawingML), so legacy is requested on purpose.
import { exportPptx, exportPptxLegacy } from './export';
import { importPptxFile, __internals } from './import';

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

/** Same, through the default (pptxgen) channel — the one that carries hyperlinks and native charts */
async function roundTripDefault(doc: SlideDoc): Promise<SlideDoc> {
  const exported = await exportPptx(doc);
  expect(exported.ok).toBe(true);
  if (!exported.ok) throw new Error(exported.error);
  const imported = await importPptxFile(new File([exported.value], 'fidelity-default.pptx'));
  expect(imported.ok).toBe(true);
  if (!imported.ok) throw new Error(imported.error);
  return imported.value.doc;
}

async function slideXmlOf(bytes: Uint8Array, part = 'ppt/slides/slide1.xml'): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  return (await zip.file(part)?.async('string')) ?? '';
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

describe('超链接与元素名称', () => {
  it('run 级超链接经默认通道往返保留', async () => {
    const doc = textDoc((text) => {
      text.body.paragraphs[0].runs = [
        { text: 'docs', style: { hyperlink: 'https://example.com/docs' } },
      ];
    });
    const back = await roundTripDefault(doc);
    const element = back.slides[0].elements[0] as TextElement;
    expect(element.body.paragraphs[0].runs[0]?.style?.hyperlink).toBe('https://example.com/docs');
  });

  it('元素级超链接与名称经默认通道往返保留', async () => {
    const doc = createDoc('name-default');
    const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' }) as ShapeElement;
    shape.name = 'Logo 底板';
    shape.hyperlink = 'https://example.com/logo';
    doc.slides[0].elements = [shape];

    const back = await roundTripDefault(doc);
    const element = back.slides[0].elements[0] as ShapeElement;
    expect(element.name).toBe('Logo 底板');
    expect(element.hyperlink).toBe('https://example.com/logo');
  });

  it('名称经手写通道往返保留', async () => {
    const doc = createDoc('name-legacy');
    const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' }) as ShapeElement;
    shape.name = 'Shape A';
    doc.slides[0].elements = [shape];

    const back = await roundTrip(doc);
    expect((back.slides[0].elements[0] as ShapeElement).name).toBe('Shape A');
  });
});

describe('元素透明度', () => {
  // jsdom cannot decode images, so the import side of picture transparency is covered by the e2e
  // path; here we pin the XML the writer emits.
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

  it('图片透明度写成 a:alphaModFix', async () => {
    const doc = createDoc('opacity-image');
    doc.media['media-1'] = {
      id: 'media-1',
      mime: 'image/png',
      width: 1,
      height: 1,
      bytes: PNG,
    };
    const image: ImageElement = {
      id: 'img-1',
      type: 'image',
      x: 40,
      y: 40,
      width: 320,
      height: 240,
      mediaId: 'media-1',
      opacity: 0.5,
    };
    doc.slides[0].elements = [image];

    const exported = await exportPptxLegacy(doc);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(await slideXmlOf(exported.value)).toContain('<a:alphaModFix amt="50000"/>');
  });

  it('形状透明度折进填充与描边的 alpha', async () => {
    const doc = createDoc('opacity-shape');
    const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' }) as ShapeElement;
    shape.fill = { type: 'solid', color: '#4472C4' };
    shape.stroke = { color: '#2F5597', width: 2 };
    shape.opacity = 0.4;
    doc.slides[0].elements = [shape];

    const exported = await exportPptxLegacy(doc);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const xml = await slideXmlOf(exported.value);
    expect(xml).toContain('<a:srgbClr val="4472C4"><a:alpha val="40000"/></a:srgbClr>');
    expect(xml).toContain('<a:srgbClr val="2F5597"><a:alpha val="40000"/></a:srgbClr>');
  });
});

describe('连接线折线', () => {
  it('route=elbow 写成 bentConnector3 并往返保持', async () => {
    const doc = createDoc('elbow');
    const line = createLineElement(doc) as LineElement;
    line.route = 'elbow';
    doc.slides[0].elements = [line];

    const exported = await exportPptxLegacy(doc);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(await slideXmlOf(exported.value)).toContain('prst="bentConnector3"');

    const back = await roundTrip(doc);
    expect((back.slides[0].elements[0] as LineElement).route).toBe('elbow');
  });
});

describe('组合缩放', () => {
  it('缩放会递归到嵌套组合与线条端点', () => {
    const line: LineElement = {
      id: 'line-1',
      type: 'line',
      x: 10,
      y: 10,
      width: 30,
      height: 20,
      points: [0, 0, 30, 20],
      stroke: { color: '#000000', width: 1 },
    };
    const inner: GroupElement = {
      id: 'g2',
      type: 'group',
      x: 20,
      y: 20,
      width: 40,
      height: 40,
      children: [line],
    };
    const outer: GroupElement = {
      id: 'g1',
      type: 'group',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      children: [inner],
    };

    const scaled = __internals.scaleSubtree(outer, 2, 3) as GroupElement;
    expect(scaled.width).toBe(200);
    expect(scaled.height).toBe(300);
    const innerScaled = scaled.children[0] as GroupElement;
    expect(innerScaled.width).toBe(80);
    expect(innerScaled.height).toBe(120);
    const lineScaled = innerScaled.children[0] as LineElement;
    expect(lineScaled.x).toBe(20);
    expect(lineScaled.y).toBe(30);
    expect(lineScaled.points).toEqual([0, 0, 60, 60]);
  });
});

describe('形状预设', () => {
  it('白名单之外的 prst 不再降级为矩形', async () => {
    const doc = createDoc('prst');
    doc.slides[0].elements = [
      createShapeElement(doc, { kind: 'rect', prst: 'flowChartOffpageConnector' }),
    ];

    const exported = await exportPptx(doc);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(await slideXmlOf(exported.value)).toContain('prst="flowChartOffpageConnector"');
  });
});

describe('表格表头 / 斑马纹（pptxgen 通道）', () => {
  it('按元素设置写 firstRow / bandRow 并往返保持', async () => {
    const doc = createDoc('table-flags');
    const table = createTableElement(doc, 2, 2) as TableElement;
    table.headerRow = false;
    table.bandRow = true;
    table.rows[0][0] = { ...table.rows[0][0], text: 'A' };
    doc.slides[0].elements = [table];

    const exported = await exportPptx(doc);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const xml = await slideXmlOf(exported.value);
    expect(xml).toContain('firstRow="0"');
    expect(xml).toContain('bandRow="1"');

    const back = await roundTripDefault(doc);
    const element = back.slides[0].elements.find((item) => item.type === 'table') as TableElement;
    expect(element.headerRow).toBe(false);
    expect(element.bandRow).toBe(true);
  });
});

describe('单元格多行文本', () => {
  function multiLineDoc(): SlideDoc {
    const doc = createDoc('cell-lines');
    const table = createTableElement(doc, 2, 2) as TableElement;
    table.rows[0][0] = { ...table.rows[0][0], text: '第一行\n第二行' };
    table.rows[0][1] = { ...table.rows[0][1], text: 'B' };
    doc.slides[0].elements = [table];
    return doc;
  }

  it('手写通道按段落写出并能读回', async () => {
    const back = await roundTrip(multiLineDoc());
    const element = back.slides[0].elements.find((item) => item.type === 'table') as TableElement;
    expect(element.rows[0][0].text).toBe('第一行\n第二行');
  });

  it('pptxgen 通道同样保留换行', async () => {
    const back = await roundTripDefault(multiLineDoc());
    const element = back.slides[0].elements.find((item) => item.type === 'table') as TableElement;
    expect(element.rows[0][0].text).toBe('第一行\n第二行');
  });
});

describe('图表标题', () => {
  it('原生图表标题往返保留', async () => {
    const doc = createDoc('chart-title');
    const chart = createChartElement(doc, 'bar') as ChartElement;
    chart.title = '销售趋势';
    doc.slides[0].elements = [chart];

    const back = await roundTripDefault(doc);
    const element = back.slides[0].elements[0] as ChartElement;
    expect(element.type).toBe('chart');
    expect(element.title).toBe('销售趋势');
  });
});
