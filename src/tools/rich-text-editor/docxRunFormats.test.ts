import { describe, expect, it } from 'vitest';
import { applyDocxRunFormats, highlightColor, parseDocxRunFormats } from './docxRunFormats';

/**
 * Run formats mammoth drops: `w:highlight`, `w:em` (着重号) and monospace character styles. The point of
 * the pass is that the paragraph text is unchanged — only wrappers are added at the right offsets.
 */

const document = (body: string): string =>
  `<w:document xmlns:w="w"><w:body><w:p>${body}</w:p></w:body></w:document>`;

const run = (text: string, properties = ''): string =>
  `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}<w:t>${text}</w:t></w:r>`;

const styles = `<w:styles xmlns:w="w">
  <w:style w:type="character" w:styleId="Code"><w:rPr>
    <w:rFonts w:ascii="Consolas"/><w:shd w:fill="F4F4F4"/>
  </w:rPr></w:style>
</w:styles>`;

describe('parseDocxRunFormats', () => {
  it('records highlight, emphasis and code runs with their offsets', () => {
    const xml = document(
      run('前置') +
        run('高亮', '<w:highlight w:val="yellow"/>') +
        run('中') +
        run('着重', '<w:em w:val="dot"/>') +
        run('等宽', '<w:rStyle w:val="Code"/>'),
    );
    const parsed = parseDocxRunFormats(xml, styles);
    expect(parsed.texts).toEqual(['前置高亮中着重等宽']);
    expect(parsed.items).toEqual([
      { block: 0, start: 2, end: 4, highlight: 'yellow' },
      { block: 0, start: 5, end: 7, emphasis: 'dot' },
      { block: 0, start: 7, end: 9, code: true },
    ]);
  });

  it('does not advance the offset over deleted text', () => {
    const xml = `<w:document xmlns:w="w"><w:body><w:p>
      <w:r><w:t>甲</w:t></w:r>
      <w:del w:id="1"><w:r><w:delText>旧</w:delText></w:r></w:del>
      <w:r><w:rPr><w:highlight w:val="green"/></w:rPr><w:t>乙</w:t></w:r>
    </w:p></w:body></w:document>`;
    const parsed = parseDocxRunFormats(xml, '');
    expect(parsed.texts).toEqual(['甲乙']);
    expect(parsed.items[0]).toMatchObject({ start: 1, end: 2, highlight: 'green' });
  });

  it('ignores a document without run formats', () => {
    expect(parseDocxRunFormats(document(run('正文')), '').items).toEqual([]);
  });

  it('maps Word highlight names onto colours', () => {
    expect(highlightColor('green')).toBe('#00ff00');
    expect(highlightColor('nope')).toBe('#ffff00');
  });
});

describe('applyDocxRunFormats', () => {
  it('wraps each run in place', () => {
    const xml = document(
      run('前置') +
        run('高亮', '<w:highlight w:val="yellow"/>') +
        run('中') +
        run('着重', '<w:em w:val="dot"/>'),
    );
    const result = applyDocxRunFormats('<p>前置高亮中着重</p>', parseDocxRunFormats(xml, ''));
    expect(result.applied).toBe(2);
    expect(result.html).toContain('<mark');
    expect(result.html).toContain('data-emphasis="dot"');
    // Text order is untouched
    expect(result.html.replace(/<[^>]+>/g, '')).toBe('前置高亮中着重');
  });

  it('leaves a paragraph whose text moved alone', () => {
    const xml = document(run('高亮', '<w:highlight w:val="yellow"/>'));
    const html = '<p>完全不同的内容</p>';
    const result = applyDocxRunFormats(html, parseDocxRunFormats(xml, ''));
    expect(result.applied).toBe(0);
    expect(result.html).toBe(html);
  });
});
