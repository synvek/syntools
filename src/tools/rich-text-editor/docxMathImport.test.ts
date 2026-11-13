import { describe, expect, it } from 'vitest';
import { applyDocxMath, parseDocxMath } from './docxMathImport';

/**
 * Equations across import: mammoth drops OMML, so the formula has to be converted back to LaTeX and
 * put where Word had it — inside its paragraph, at the offset the surrounding text leaves.
 */

const run = (text: string): string => `<m:r><m:t>${text}</m:t></m:r>`;

const fraction = `<m:f><m:num>${run('a')}</m:num><m:den>${run('b')}</m:den></m:f>`;
const superscript = `<m:sSup><m:e>${run('E')}</m:e><m:sup>${run('mc')}</m:sup></m:sSup>`;
const radical =
  '<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/>' + `<m:e>${run('x+y')}</m:e></m:rad>`;

const paragraph = (body: string): string => `<w:p>${body}</w:p>`;
const text = (value: string): string => `<w:r><w:t>${value}</w:t></w:r>`;

const documentXml = (paragraphs: string): string =>
  `<w:document xmlns:w="w" xmlns:m="m"><w:body>${paragraphs}</w:body></w:document>`;

describe('parseDocxMath', () => {
  it('converts the supported OMML subset and records the paragraph offset', () => {
    const imported = parseDocxMath(
      documentXml(
        paragraph(`${text('面积')}<m:oMath>${fraction}</m:oMath>${text('为')}`) +
          paragraph(`<m:oMath>${superscript}</m:oMath>${text('质量')}`),
      ),
    );
    expect(imported.items.map((item) => item.latex)).toEqual(['\\frac{a}{b}', '{E}^{mc}']);
    // "面积" is two characters, so the fraction starts at 2
    expect(imported.items.map((item) => item.offset)).toEqual([2, 0]);
    // The equation text itself never joins the paragraph text
    expect(imported.texts).toEqual(['面积为', '质量']);
  });

  it('marks m:oMathPara as a display equation and keeps it out of the paragraph text', () => {
    const imported = parseDocxMath(
      documentXml(paragraph(`<m:oMathPara><m:oMath>${radical}</m:oMath></m:oMathPara>`)),
    );
    expect(imported.items[0]?.display).toBe(true);
    expect(imported.texts[0]).toBe('');
  });

  it('ignores a document without equations', () => {
    const imported = parseDocxMath(documentXml(paragraph(text('没有公式'))));
    expect(imported.items).toEqual([]);
  });
});

describe('applyDocxMath', () => {
  it('splices the formula back at its character offset inside the paragraph', () => {
    const imported = parseDocxMath(
      documentXml(paragraph(`${text('面积')}<m:oMath>${fraction}</m:oMath>${text('为')}`)),
    );
    const result = applyDocxMath('<p>面积为</p>', imported);
    expect(result.applied).toBe(1);
    expect(result.html).toContain(
      '<p>面积<span data-math="inline" data-latex="\\frac{a}{b}"></span>为</p>',
    );
  });

  it('recreates a formula-only paragraph as a block-level formula', () => {
    const imported = parseDocxMath(
      documentXml(
        paragraph(text('面积')) +
          paragraph(`<m:oMathPara><m:oMath>${radical}</m:oMath></m:oMathPara>`) +
          paragraph(text('质量')),
      ),
    );
    // The empty paragraph has no text to align on: it is placed before the next paragraph that matched.
    // `m:oMathPara` is a line of its own in Word, so it becomes the block node (a `<div>` inside a `<p>`
    // would be hoisted out by the HTML parser, which is why this used to degrade to an inline span)
    const result = applyDocxMath('<p>面积</p><p>质量</p>', imported);
    expect(result.applied).toBe(1);
    expect(result.html).toContain(
      '<div data-math="block" data-display="true" data-latex="\\sqrt{x+y}"></div>',
    );
    expect(result.html.indexOf('data-math')).toBeLessThan(result.html.indexOf('质量'));
  });

  it('keeps an oMathPara that shares its line with text inline (it cannot be hoisted)', () => {
    const imported = parseDocxMath(
      documentXml(
        paragraph(`${text('式')}<m:oMathPara><m:oMath>${radical}</m:oMath></m:oMathPara>`),
      ),
    );
    const result = applyDocxMath('<p>式</p>', imported);
    expect(result.applied).toBe(1);
    expect(result.html).toContain(
      '<p>式<span data-math="inline" data-latex="\\sqrt{x+y}"></span></p>',
    );
  });

  it('leaves the document alone when the paragraph text moved', () => {
    const imported = parseDocxMath(
      documentXml(paragraph(`${text('面积')}<m:oMath>${fraction}</m:oMath>${text('为')}`)),
    );
    const html = '<p>面积大小不同</p>';
    const result = applyDocxMath(html, imported);
    expect(result.applied).toBe(0);
    expect(result.html).toBe(html);
  });

  it('is a no-op without equations', () => {
    const html = '<p>正文</p>';
    expect(applyDocxMath(html, { items: [], texts: [] }).html).toBe(html);
  });
});
