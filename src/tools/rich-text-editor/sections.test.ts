import { describe, expect, it } from 'vitest';
import { planPageBlocks } from './core';
import { normalizePageSetup } from './pageSetup';
import {
  MAX_SECTIONS,
  createSection,
  normalizeSections,
  parseDocxSections,
  planSectionedPageBlocks,
  splitSectionNodes,
  resolveSectionPageSetup,
  sectionBoxesOf,
  type SectionBox,
  type SectionedBlock,
} from './sections';

const box = (
  contentHeight: number,
  startType: 'nextPage' | 'continuous' = 'nextPage',
): SectionBox => ({ contentHeight, advancePx: contentHeight + 20, startType });

const block = (top: number, height: number, section = 0): SectionedBlock => ({
  top,
  height,
  section,
});

describe('节模型归一化', () => {
  it('旧文档没有 sections 时迁移为单节并保留原页面设置', () => {
    const setup = normalizePageSetup({ size: 'Letter', orientation: 'landscape' });
    const sections = normalizeSections(undefined, setup);
    expect(sections).toHaveLength(1);
    expect(sections[0].pageSetup.size).toBe('Letter');
    expect(sections[0].pageSetup.orientation).toBe('landscape');
    expect(sections[0].startType).toBe('nextPage');
  });

  it('非法 startType 回落到 nextPage，重复 id 自动去重', () => {
    const sections = normalizeSections([
      { id: 'a', pageSetup: { size: 'A4' } },
      { id: 'a', pageSetup: { size: 'Letter' }, startType: 'sideways' },
    ]);
    expect(sections.map((section) => section.id)).toEqual(['a', 'a-2']);
    expect(sections[1].startType).toBe('nextPage');
    expect(sections[1].pageSetup.size).toBe('Letter');
  });

  it('第一节不允许链接到前一节', () => {
    const sections = normalizeSections([{ headerLinked: true, footerLinked: true }]);
    expect(sections[0].headerLinked).toBe(false);
    expect(sections[0].footerLinked).toBe(false);
  });

  it(`节数量上限为 ${MAX_SECTIONS}`, () => {
    const raw = Array.from({ length: MAX_SECTIONS + 5 }, (_, index) => ({ id: `s${index}` }));
    expect(normalizeSections(raw)).toHaveLength(MAX_SECTIONS);
  });

  it('每个节持有独立的 margin 对象（避免默认值被就地修改）', () => {
    const a = createSection('a');
    const b = createSection('b');
    a.pageSetup.margin.top = 40;
    expect(b.pageSetup.margin.top).not.toBe(40);
  });
});

describe('节级页面设置解析', () => {
  it('链接到前一节时继承最近的拥有者（可跨多级链）', () => {
    const sections = [
      createSection('a', normalizePageSetup({ header: 'A 页眉', footer: 'A 页脚' })),
      { ...createSection('b'), headerLinked: true, footerLinked: true },
      { ...createSection('c', normalizePageSetup({ header: 'C 页眉' })), footerLinked: true },
    ];
    expect(resolveSectionPageSetup(sections, 1).header).toBe('A 页眉');
    expect(resolveSectionPageSetup(sections, 2).header).toBe('C 页眉');
    expect(resolveSectionPageSetup(sections, 2).footer).toBe('A 页脚');
  });

  it('未链接时使用本节自己的页眉页脚', () => {
    const sections = [
      createSection('a', normalizePageSetup({ header: 'A' })),
      createSection('b', normalizePageSetup({ header: 'B' })),
    ];
    expect(resolveSectionPageSetup(sections, 1).header).toBe('B');
  });

  it('横向节的可用高度小于纵向节', () => {
    const sections = [
      createSection('portrait'),
      createSection('landscape', normalizePageSetup({ orientation: 'landscape' })),
    ];
    const boxes = sectionBoxesOf(sections);
    expect(boxes).toHaveLength(2);
    expect(boxes[1].contentHeight).toBeLessThan(boxes[0].contentHeight);
    expect(boxes[0].startType).toBe('nextPage');
  });
});

describe('节级分页（planSectionedPageBlocks）', () => {
  it('单节时与 planPageBlocks 结果一致', () => {
    const blocks = [block(0, 600), block(600, 600), block(1200, 100), block(1300, 600)];
    const plain = blocks.map(({ top, height }) => ({ top, height }));
    expect(planSectionedPageBlocks(blocks, [box(971)])).toEqual(planPageBlocks(plain, 971));
  });

  it('nextPage 节强制从下一个可见块起新页', () => {
    // 第一节只占 100px，剩余空间充足，但新节仍必须换页
    const blocks = [block(0, 100, 0), block(100, 0, 1), block(100, 100, 1)];
    expect(planSectionedPageBlocks(blocks, [box(900), box(900)])).toEqual([2]);
  });

  it('continuous 节不强制换页', () => {
    const blocks = [block(0, 100, 0), block(100, 100, 1)];
    expect(planSectionedPageBlocks(blocks, [box(900), box(900, 'continuous')])).toEqual([]);
  });

  it('按节切换可用页高', () => {
    const blocks = [block(0, 100, 0), block(100, 400, 1)];
    expect(planSectionedPageBlocks(blocks, [box(200), box(500, 'continuous')])).toEqual([]);
    expect(planSectionedPageBlocks(blocks, [box(200), box(300, 'continuous')])).toEqual([1]);
  });

  it('超高块溢出而不产生空页', () => {
    expect(planSectionedPageBlocks([block(0, 3000)], [box(971)])).toEqual([]);
  });

  it('boxes 为空时不分页', () => {
    expect(planSectionedPageBlocks([block(0, 100)], [])).toEqual([]);
  });
});

describe('分页性能（§3.2.4 验收：50 页 < 50ms/次）', () => {
  /**
   * 3000 blocks ≈ 50 A4 pages. This measures the pagination *algorithm* only; DOM measurement is
   * covered by the e2e run (a 50-page document must settle within its poll timeout).
   */
  it('3000 块三节文档的分页计算中位数 < 50ms', () => {
    const blocks: SectionedBlock[] = Array.from({ length: 3000 }, (_, index) => ({
      top: index * 24,
      height: 24,
      section: index < 1000 ? 0 : index < 2000 ? 1 : 2,
    }));
    const boxes = [box(971), box(660, 'continuous'), box(971)];
    for (let index = 0; index < 5; index += 1) planSectionedPageBlocks(blocks, boxes);

    const samples: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const startedAt = performance.now();
      planSectionedPageBlocks(blocks, boxes);
      samples.push(performance.now() - startedAt);
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)];
    expect(median).toBeLessThan(50);
  });
});

describe('w:sectPr 解析（P2-2.4 导入侧）', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p/>
    <w:sectPr>
      <w:headerReference w:type="default" r:id="rId7"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>
      <w:cols w:num="2"/>
      <w:type w:val="continuous"/>
    </w:sectPr>
    <w:sectPr>
      <w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>
      <w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850"/>
      <w:titlePg/>
    </w:sectPr>
  </w:body>
</w:document>`;

  it('按文档顺序读出每节的纸张 / 方向 / 页边距 / 分栏 / 起始方式', () => {
    const sections = parseDocxSections(xml);
    expect(sections).toHaveLength(2);

    expect(sections[0].pageSetup.size).toBe('A4');
    expect(sections[0].pageSetup.orientation).toBe('portrait');
    expect(sections[0].pageSetup.margin).toEqual({ top: 20, right: 20, bottom: 20, left: 20 });
    expect(sections[0].pageSetup.columns).toBe(2);
    expect(sections[0].startType).toBe('continuous');

    expect(sections[1].pageSetup.size).toBe('A4');
    expect(sections[1].pageSetup.orientation).toBe('landscape');
    expect(sections[1].pageSetup.margin?.top).toBe(15);
    expect(sections[1].pageSetup.differentFirstPage).toBe(true);
    expect(sections[1].startType).toBe('nextPage');
  });

  it('用 headerReference / footerReference 的存在判断是否链接到前一节', () => {
    const sections = parseDocxSections(xml);
    expect(sections[0].headerLinked).toBe(false);
    expect(sections[0].footerLinked).toBe(true);
    expect(sections[1].headerLinked).toBe(true);
  });

  it('空内容或非法 XML 返回空数组', () => {
    expect(parseDocxSections('')).toEqual([]);
    expect(parseDocxSections('<w:document><w:body>')).toEqual([]);
  });

  it('不完整的 pgMar 不会写出一半的页边距', () => {
    const partial =
      '<w:document xmlns:w="w"><w:body><w:sectPr><w:pgMar w:top="1134"/></w:sectPr></w:body></w:document>';
    expect(parseDocxSections(partial)[0].pageSetup.margin).toBeUndefined();
  });
});

describe('分节符 DOM（导出侧切分）', () => {
  const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
  const base = normalizePageSetup({ size: 'A4' });

  it('按分节符切分内容，并读取每节的页面设置快照', () => {
    const doc = parse(
      '<p>a</p><div data-section-break="nextPage" data-section-setup=\'{"size":"Letter"}\'></div><p>b</p><h1>c</h1>',
    );
    const slices = splitSectionNodes(Array.from(doc.body.children), base);
    expect(slices).toHaveLength(2);
    expect(slices[0].elements).toHaveLength(1);
    expect(slices[0].pageSetup.size).toBe('A4');
    expect(slices[1].elements).toHaveLength(2);
    expect(slices[1].pageSetup.size).toBe('Letter');
    expect(slices[1].startType).toBe('nextPage');
  });

  it('识别 continuous 起始方式', () => {
    const doc = parse('<p>a</p><div data-section-break="continuous"></div><p>b</p>');
    const slices = splitSectionNodes(Array.from(doc.body.children), base);
    expect(slices[1].startType).toBe('continuous');
  });

  it('快照 JSON 非法时回落到文档设置（保留分节符本身）', () => {
    const doc = parse(
      '<p>a</p><div data-section-break="nextPage" data-section-setup="{oops"></div><p>b</p>',
    );
    const slices = splitSectionNodes(Array.from(doc.body.children), base);
    expect(slices).toHaveLength(2);
    expect(slices[1].pageSetup.size).toBe('A4');
  });

  it('连续两个分节符不产生空节', () => {
    const doc = parse(
      '<p>a</p><div data-section-break="nextPage"></div><div data-section-break="nextPage"></div><p>b</p>',
    );
    const slices = splitSectionNodes(Array.from(doc.body.children), base);
    expect(slices).toHaveLength(2);
    expect(slices[1].elements).toHaveLength(1);
  });

  it('没有分节符时返回单节（与旧行为一致）', () => {
    const doc = parse('<p>a</p><p>b</p>');
    const slices = splitSectionNodes(Array.from(doc.body.children), base);
    expect(slices).toHaveLength(1);
    expect(slices[0].elements).toHaveLength(2);
  });

  it('识别「链接到前一节」标志，且首节不参与链接', () => {
    const doc = parse(
      '<p>a</p><div data-section-break="nextPage" data-section-header-linked="true" data-section-footer-linked="true"></div><p>b</p>',
    );
    const slices = splitSectionNodes(Array.from(doc.body.children), base);
    expect(slices[0].headerLinked).toBe(false);
    expect(slices[0].footerLinked).toBe(false);
    expect(slices[1].headerLinked).toBe(true);
    expect(slices[1].footerLinked).toBe(true);
  });
});
