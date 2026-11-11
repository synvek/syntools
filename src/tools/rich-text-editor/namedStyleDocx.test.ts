import { describe, expect, it } from 'vitest';
import { applyStyleClasses, docxStyleMapEntries, parseDocxStylesXml } from './namedStyleDocx';
import type { NamedStyle } from './namedStyles';

/**
 * Named styles ↔ .docx (P1-1 second slice): reading `word/styles.xml`, building the mammoth style map
 * and turning its marker classes back into `data-rte-style`. The export side is asserted in
 * `docx.test.ts` because it needs a real package.
 */

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:styleId="body"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="title">
    <w:name w:val="我的标题"/>
    <w:basedOn w:val="body"/>
    <w:pPr><w:outlineLvl w:val="0"/><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:sz w:val="60"/><w:b/><w:color w:val="B45309"/><w:rFonts w:ascii="Inter"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:outlineLvl w:val="1"/></w:pPr>
  </w:style>
  <w:style w:type="character" w:styleId="Strong"><w:name w:val="Strong"/></w:style>
  <w:style w:type="paragraph" w:styleId="正文样式"><w:name w:val="正文样式"/></w:style>
</w:styles>`;

describe('parseDocxStylesXml', () => {
  it('reads paragraph styles with their run and paragraph properties', () => {
    const styles = parseDocxStylesXml(STYLES_XML);
    const title = styles.find((style) => style.id === 'title');
    expect(title).toBeDefined();
    expect(title?.name).toBe('我的标题');
    expect(title?.basedOn).toBe('body');
    expect(title?.headingLevel).toBe(1);
    expect(title?.font).toEqual({ size: 30, color: '#b45309', family: 'Inter', bold: true });
    expect(title?.paragraph).toEqual({ align: 'center' });
  });

  it('maps Word built-in heading ids onto the app heading styles', () => {
    const styles = parseDocxStylesXml(STYLES_XML);
    const heading = styles.find((style) => style.id === 'heading2');
    expect(heading?.headingLevel).toBe(2);
    expect(styles.map((style) => style.id)).not.toContain('heading1');
  });

  it('strips the export prefix, so our own styles beat Word built-ins (P1-1 round trip)', () => {
    const xml =
      '<w:styles><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:sz w:val="56"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="rte-title"><w:name w:val="章节标题"/><w:rPr><w:sz w:val="60"/></w:rPr></w:style></w:styles>';
    const styles = parseDocxStylesXml(xml);
    // Both slug to "title"; the prefixed one is the document's own definition and must win
    expect(styles.map((style) => style.id)).toEqual(['title']);
    expect(styles[0]?.name).toBe('章节标题');
    expect(styles[0]?.font?.size).toBe(30);
    expect(styles[0]?.owned).toBe(true);
  });

  it('skips character styles and keeps non-Latin ids addressable', () => {
    const styles = parseDocxStylesXml(STYLES_XML);
    expect(styles.map((style) => style.id)).not.toContain('strong');
    // A Chinese style id has no Latin slug: it gets a stable fallback instead of being dropped
    expect(styles.some((style) => /^style-\d+$/.test(style.id))).toBe(true);
  });

  it('degrades to no styles for empty or malformed input', () => {
    expect(parseDocxStylesXml('')).toEqual([]);
    expect(parseDocxStylesXml('<w:styles><w:style')).toEqual([]);
    expect(parseDocxStylesXml('<html><body><p>x</p></body></html>')).toEqual([]);
  });
});

describe('docxStyleMapEntries', () => {
  const styles: NamedStyle[] = [
    { id: 'body', name: 'Normal', owned: true },
    { id: 'title', name: "我的'标题", owned: true },
    { id: 'plain', owned: true },
    // A Word style we never wrote: it must keep mammoth's built-in handling
    { id: 'listparagraph', name: 'List Paragraph' },
  ];

  it('maps each named style to a marker class mammoth can emit', () => {
    expect(docxStyleMapEntries(styles)).toEqual([
      "p[style-name='Normal'] => p.rte-style-body",
      "p[style-name='我的’标题'] => p.rte-style-title",
    ]);
  });
});

describe('applyStyleClasses', () => {
  const styles: NamedStyle[] = [
    { id: 'title', name: '我的标题' },
    { id: 'aside', name: '旁注' },
    { id: 'heading2', name: '小标题', headingLevel: 2 },
  ];

  it('turns marker classes into style attributes and reports the styles in use', () => {
    const html = '<p class="rte-style-title">第一章</p><p class="rte-style-aside keep">小节</p>';
    const result = applyStyleClasses(html, styles);
    expect(result.html).toContain('<p data-rte-style="title">第一章</p>');
    expect(result.html).toContain('<p class="keep" data-rte-style="aside">小节</p>');
    expect(result.used.map((style) => style.id)).toEqual(['title', 'aside']);
  });

  it('returns a heading node for styles that declare a heading level', () => {
    const result = applyStyleClasses('<p class="rte-style-heading2">小节</p>', styles);
    expect(result.html).toBe('<h2 data-rte-style="heading2">小节</h2>');
    expect(result.used.map((style) => style.id)).toEqual(['heading2']);
  });

  it('drops unknown markers instead of inventing a style', () => {
    const result = applyStyleClasses('<p class="rte-style-ghost">x</p>', styles);
    expect(result.html).toBe('<p>x</p>');
    expect(result.used).toEqual([]);
  });

  it('leaves plain markup alone', () => {
    const html = '<p>正文</p>';
    expect(applyStyleClasses(html, styles).html).toBe(html);
  });
});
