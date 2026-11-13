import { describe, expect, it } from 'vitest';
import { applyDocxPageBreaks, parseDocxSectionBreaks } from './docxSectionBreaks';

/**
 * Section breaks are merged into one section on import, but a `nextPage` section break is also a page
 * break — the table of contents has to start on a new page like it does in Word.
 */

const document = (body: string): string =>
  `<w:document xmlns:w="w"><w:body>${body}<w:sectPr/></w:body></w:document>`;

const para = (text: string, sectPr = ''): string =>
  `<w:p><w:pPr>${sectPr}</w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;

describe('parseDocxSectionBreaks', () => {
  it('anchors a section break to the paragraph that opens the new page', () => {
    const xml = document(
      para('封面') + para('', '<w:sectPr><w:type w:val="nextPage"/></w:sectPr>') + para('目录'),
    );
    const anchors = parseDocxSectionBreaks(xml);
    expect(anchors.texts).toEqual(['封面', '目录']);
    expect(anchors.breakBefore).toEqual([1]);
  });

  it('ignores continuous sections: they do not start a new page', () => {
    const xml = document(
      para('甲') + para('', '<w:sectPr><w:type w:val="continuous"/></w:sectPr>') + para('乙'),
    );
    expect(parseDocxSectionBreaks(xml).breakBefore).toEqual([]);
  });

  it('treats a missing w:type as nextPage, which is Word’s default', () => {
    const xml = document(para('甲') + para('', '<w:sectPr/>') + para('乙'));
    expect(parseDocxSectionBreaks(xml).breakBefore).toEqual([1]);
  });
});

describe('applyDocxPageBreaks', () => {
  it('inserts the page break before the matching paragraph', () => {
    const anchors = parseDocxSectionBreaks(
      document(para('封面') + para('', '<w:sectPr/>') + para('目录')),
    );
    const result = applyDocxPageBreaks('<p>封面</p><p>目录</p>', anchors);
    expect(result.inserted).toBe(1);
    expect(result.html).toContain(
      '<p>封面</p><div data-page-break="true" class="rte-page-break-node"></div><p>目录</p>',
    );
  });

  it('leaves the html alone when the anchor paragraph is missing', () => {
    const anchors = parseDocxSectionBreaks(
      document(para('封面') + para('', '<w:sectPr/>') + para('目录')),
    );
    const html = '<p>封面</p><p>别的段落</p>';
    const result = applyDocxPageBreaks(html, anchors);
    expect(result.inserted).toBe(0);
    expect(result.html).toBe(html);
  });

  it('is a no-op without section breaks', () => {
    const html = '<p>正文</p>';
    expect(applyDocxPageBreaks(html, { texts: [], breakBefore: [] }).html).toBe(html);
  });
});
