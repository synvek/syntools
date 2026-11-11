import { describe, expect, it } from 'vitest';
import { applyParagraphControls, parseDocxParagraphControls } from './docxParagraphControls';

/**
 * Pagination control across a .docx round trip (P1-4 first slice).
 * The export side is covered in `docx.test.ts`; here we cover reading `w:pPr` back and the positional
 * mapping, including the guard that refuses to guess when the block counts disagree.
 */

const paragraph = (properties: string, text = '文字'): string =>
  `<w:p><w:pPr>${properties}</w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;

const documentXml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraph('<w:keepNext/>')}
    ${paragraph('<w:keepLines/>')}
    ${paragraph('<w:widowControl w:val="0"/>')}
    ${paragraph('')}
    <w:p/>
  </w:body>
</w:document>`;

describe('parseDocxParagraphControls', () => {
  it('reads the three toggles per paragraph, in document order', () => {
    expect(
      parseDocxParagraphControls(documentXml).map((control) => ({
        keepNext: control.keepNext,
        keepLines: control.keepLines,
        widowControl: control.widowControl,
        lineHeight: control.lineHeight,
      })),
    ).toEqual([
      { keepNext: true, keepLines: false, widowControl: null, lineHeight: null },
      { keepNext: false, keepLines: true, widowControl: null, lineHeight: null },
      // w:val="0" is the explicit off switch
      { keepNext: false, keepLines: false, widowControl: false, lineHeight: null },
      { keepNext: false, keepLines: false, widowControl: null, lineHeight: null },
      // A self-closing w:p is still a paragraph (it becomes an empty <p>)
      { keepNext: false, keepLines: false, widowControl: null, lineHeight: null },
    ]);
  });

  it('reads w:tabs as px and keeps every alignment Word writes', () => {
    const xml = paragraph(
      '<w:tabs><w:tab w:val="left" w:pos="1440"/><w:tab w:val="center" w:pos="2880"/><w:tab w:val="right" w:pos="4320"/><w:tab w:val="decimal" w:pos="5040"/></w:tabs>',
    );
    expect(parseDocxParagraphControls(xml)[0]?.tabStops).toEqual([
      { pos: 96, align: 'left' },
      { pos: 192, align: 'center' },
      { pos: 288, align: 'right' },
      { pos: 336, align: 'decimal' },
    ]);
  });

  it('drops w:tab entries that are not stops (clear / bar) and sorts by position', () => {
    const xml = paragraph(
      '<w:tabs><w:tab w:val="clear" w:pos="720"/><w:tab w:val="bar" w:pos="1440"/><w:tab w:val="left" w:pos="2160"/></w:tabs>',
    );
    expect(parseDocxParagraphControls(xml)[0]?.tabStops).toEqual([{ pos: 144, align: 'left' }]);
  });

  it('does not mistake the w:tabs property block for a run tab', () => {
    const xml = `<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="1440"/></w:tabs></w:pPr><w:r><w:tab/><w:t>乙</w:t></w:r></w:p>`;
    // `<w:tab/>` inside a run is the tab itself; the reader only cares about the stop list
    expect(parseDocxParagraphControls(xml)[0]?.tabStops).toEqual([{ pos: 96, align: 'left' }]);
  });

  it('only looks inside w:pPr, not at run properties', () => {
    const xml = `<w:p><w:r><w:rPr><w:keepNext/></w:rPr><w:t>x</w:t></w:r></w:p>`;
    expect(parseDocxParagraphControls(xml)[0]?.keepNext).toBe(false);
  });

  it('reads line spacing as a multiple when the rule is auto (240 = single)', () => {
    const xml =
      paragraph('<w:spacing w:line="360" w:lineRule="auto"/>') +
      paragraph('<w:spacing w:line="240"/>') +
      // exact / atLeast are absolute twips, not multiples: refusing beats guessing wrong
      paragraph('<w:spacing w:line="360" w:lineRule="exact"/>');
    const controls = parseDocxParagraphControls(xml);
    expect(controls.map((control) => control.lineHeight)).toEqual([1.5, 1, null]);
  });

  it('returns nothing for markup without paragraphs', () => {
    expect(parseDocxParagraphControls('<w:document><w:body/></w:document>')).toEqual([]);
  });
});

describe('applyParagraphControls', () => {
  const controls = parseDocxParagraphControls(documentXml);
  const html = '<p>一</p><h1>标题</h1><p>三</p><p>四</p><p></p>';

  it('stamps the flags onto the matching blocks', () => {
    const result = applyParagraphControls(html, controls);
    expect(result).toContain('<p data-keep-next="true">一</p>');
    expect(result).toContain('<h1 data-keep-lines="true">标题</h1>');
    expect(result).toContain('<p data-widow-control="off">三</p>');
    expect(result).toContain('<p>四</p>');
  });

  it('refuses to guess when the block count does not match', () => {
    // Lists make mammoth emit <li> instead of a paragraph wrapper, so positions stop lining up
    const mismatched = '<ul><li>一</li></ul><p>二</p>';
    expect(applyParagraphControls(mismatched, controls)).toBe(mismatched);
  });

  it('leaves the document alone when nothing was parsed', () => {
    expect(applyParagraphControls(html, [])).toBe(html);
  });

  it('stamps line spacing as an inline style, keeping other styles intact', () => {
    const spacing = parseDocxParagraphControls(
      paragraph('<w:spacing w:line="360" w:lineRule="auto"/>'),
    );
    const result = applyParagraphControls('<p style="margin-left: 24px">一</p>', spacing);
    expect(result).toContain('line-height: 1.5');
    expect(result).toContain('margin-left: 24px');
  });

  it('stamps tab stops on the matching block', () => {
    const tabs = parseDocxParagraphControls(
      `<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="1440"/></w:tabs></w:pPr>` +
        `<w:r><w:tab/><w:t>一</w:t></w:r></w:p>`,
    );
    expect(applyParagraphControls('<p>一</p>', tabs)).toContain('data-tab-stops="96:left"');
  });
});
