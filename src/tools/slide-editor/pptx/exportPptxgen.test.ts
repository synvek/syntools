import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  createChartElement,
  createDoc,
  createFormulaElement,
  createShapeElement,
  createTableElement,
  createTextElement,
} from '../model/factory';
import type { SlideDoc, TextElement } from '../model/types';
import { exportPptxPptxGen } from './exportPptxgen';
import { importPptxFile } from './import';

/**
 * pptxgenjs 通道的结构性断言。
 *
 * 这里不比较 XML 细节（那是 legacy 通道的事），只保证：
 * 包体合法、部件齐全、图表/母版/备注/背景等关键能力真的写进去了。
 */

function sampleDoc(): SlideDoc {
  const doc = createDoc('pptxgen demo');
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

async function zipped(doc: SlideDoc): Promise<{ bytes: Uint8Array; zip: JSZip }> {
  const result = await exportPptxPptxGen(doc);
  expect(result.ok).toBe(true);
  const bytes = (result as { ok: true; value: Uint8Array }).value;
  return { bytes, zip: await JSZip.loadAsync(bytes) };
}

describe('pptxgenjs 导出通道', () => {
  it('空文档返回 EMPTY', async () => {
    const doc = createDoc('empty');
    doc.slides = [];
    const result = await exportPptxPptxGen(doc);
    expect(result).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('产出合法 zip 包与最小 OPC 集合', async () => {
    const { bytes, zip } = await zipped(sampleDoc());
    // PK zip magic
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(zip.file('[Content_Types].xml')).not.toBeNull();
    expect(zip.file('ppt/presentation.xml')).not.toBeNull();
    expect(zip.file('ppt/slides/slide1.xml')).not.toBeNull();
    expect(zip.file('ppt/slideMasters/slideMaster1.xml')).not.toBeNull();
    expect(zip.file('ppt/slideLayouts/slideLayout1.xml')).not.toBeNull();
    expect(zip.file('ppt/theme/theme1.xml')).not.toBeNull();
  });

  it('按文档尺寸定义自定义 layout（16:9 = 13.33in × 7.5in）', async () => {
    const { zip } = await zipped(sampleDoc());
    const xml = (await zip.file('ppt/presentation.xml')?.async('string')) ?? '';
    expect(xml).toContain('cx="12192000"');
    expect(xml).toContain('cy="6858000"');
  });

  it('文本内容写进 slide，且中英文均保留', async () => {
    const { zip } = await zipped(sampleDoc());
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    expect(xml).toContain('Hello');
    expect(xml).toContain('幻灯片');
  });

  it('页面背景覆盖为文档设定色（PPT 背景色不带 #）', async () => {
    const { zip } = await zipped(sampleDoc());
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    expect(xml).toContain('F2F2F2');
  });

  it('母版元素与背景写进母版派生的版式（pptxgenjs 的 master 实现）', async () => {
    const doc = sampleDoc();
    doc.masters[0].elements = [createTextElement(doc, '母版页脚')];
    doc.masters[0].background = '#123456';
    const { zip } = await zipped(doc);
    // pptxgenjs 的 defineSlideMaster 把 objects 写进它新建的 slideLayout 部件
    const layouts = Object.keys(zip.files).filter((name) =>
      /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(name),
    );
    const all = await Promise.all(
      layouts.map((name) => zip.file(name)?.async('string') ?? Promise.resolve('')),
    );
    expect(all.join('')).toContain('母版页脚');
    expect(all.join('')).toContain('123456');
  });

  it('页面所属版式的元素会被写到该页上（多版式不可表达时的等价落盘）', async () => {
    const doc = sampleDoc();
    doc.layouts[0].elements = [createTextElement(doc, '版式占位')];
    const { zip } = await zipped(doc);
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    expect(xml).toContain('版式占位');
  });

  it('表格合并写为 gridSpan 属性', async () => {
    const doc = sampleDoc();
    const table = doc.slides[0].elements.find((element) => element.type === 'table');
    if (table?.type === 'table') {
      table.rows[0][0].colSpan = 2;
      table.rows[0][1] = { ...table.rows[0][1], covered: true, text: '' };
    }
    const { zip } = await zipped(doc);
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    expect(xml).toContain('gridSpan="2"');
  });

  it('图表产出独立 chart 部件（PPT 中可编辑数据）', async () => {
    const doc = sampleDoc();
    doc.slides[0].elements = [createChartElement(doc, 'bar')];
    const { zip } = await zipped(doc);
    const charts = Object.keys(zip.files).filter((name) =>
      /^ppt\/charts\/chart\d+\.xml$/.test(name),
    );
    expect(charts.length).toBeGreaterThan(0);
    const chart = (await zip.file(charts[0])?.async('string')) ?? '';
    // 原生图表必须带类别与数值缓存，否则 PowerPoint 里无法编辑数据
    expect(chart).toContain('c:cat');
    expect(chart).toContain('c:val');
    expect(chart).toContain('Series 1');
    const slide = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    expect(slide).toContain('graphicFrame');
  });

  it('备注写出 notesSlide 部件', async () => {
    const doc = sampleDoc();
    doc.slides[0].notes = '先讲背景再讲结论';
    const { zip } = await zipped(doc);
    const notes = (await zip.file('ppt/notesSlides/notesSlide1.xml')?.async('string')) ?? '';
    expect(notes).toContain('先讲背景再讲结论');
  });

  it('公式降级为展示 LaTeX 源码的文本框，不丢内容', async () => {
    const doc = sampleDoc();
    doc.slides[0].elements = [createFormulaElement(doc, 'E = mc^2')];
    const { zip } = await zipped(doc);
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    expect(xml).toContain('mc');
  });

  it('隐藏元素不导出', async () => {
    const doc = sampleDoc();
    const hidden = createTextElement(doc, '不该出现') as TextElement;
    hidden.visible = false;
    doc.slides[0].elements = [hidden];
    const { zip } = await zipped(doc);
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    expect(xml).not.toContain('不该出现');
  });

  it('图表往返：导出的原生图表能被重新导入为可编辑 ChartElement', async () => {
    const doc = sampleDoc();
    const chart = createChartElement(doc, 'bar');
    chart.categories = ['Q1', 'Q2'];
    chart.series = [
      { name: '营收', values: [10, 20] },
      { name: '成本', values: [6, 9] },
    ];
    doc.slides[0].elements = [chart];
    const { bytes } = await zipped(doc);

    const imported = await importPptxFile(new File([bytes], 'chart.pptx'));
    expect(imported.ok).toBe(true);
    const back = (imported as { ok: true; value: { doc: SlideDoc } }).value.doc;
    const element = back.slides[0].elements.find((item) => item.type === 'chart');
    expect(element?.type).toBe('chart');
    if (element?.type === 'chart') {
      expect(element.chartType).toBe('bar');
      expect(element.categories).toEqual(['Q1', 'Q2']);
      expect(element.series.map((series) => series.name)).toEqual(['营收', '成本']);
      expect(element.series[0]?.values).toEqual([10, 20]);
    }
  });

  it('同一页内 p:cNvPr 的 id 唯一（pptxgenjs 混排形状/表格时会重复）', async () => {
    const doc = sampleDoc();
    doc.slides[0].elements = [
      createTextElement(doc, '文本'),
      createChartElement(doc, 'bar'),
      createShapeElement(doc, { kind: 'rect', prst: 'rect' }),
      createTableElement(doc, 2, 2),
    ];
    const { zip } = await zipped(doc);
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('组合元素展平为绝对坐标元素', async () => {
    const doc = sampleDoc();
    const inner = createTextElement(doc, '组内文本') as TextElement;
    inner.x = 10;
    inner.y = 20;
    doc.slides[0].elements = [
      {
        id: 'g1',
        type: 'group',
        x: 100,
        y: 200,
        width: 400,
        height: 200,
        children: [inner],
      },
    ];
    const { zip } = await zipped(doc);
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    expect(xml).toContain('组内文本');
    // 110in·px → EMU：100+10=110px
    expect(xml).toContain('x="1047750"');
  });
});
