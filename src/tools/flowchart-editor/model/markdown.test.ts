import { describe, expect, it } from 'vitest';
import { renderInlineMarkdown, safeMarkdownHref } from './markdown';

describe('标签 Markdown 渲染', () => {
  it('渲染加粗 / 斜体 / 行内代码', () => {
    expect(renderInlineMarkdown('**加粗** 与 *斜体* 与 _斜体_')).toBe(
      '<strong>加粗</strong> 与 <em>斜体</em> 与 <em>斜体</em>',
    );
    expect(renderInlineMarkdown('`code`')).toBe('<code>code</code>');
    expect(renderInlineMarkdown('`**not bold**`')).toBe('<code>**not bold**</code>');
  });

  it('渲染安全链接，忽略危险协议', () => {
    expect(renderInlineMarkdown('[站点](https://example.com)')).toContain(
      'href="https://example.com"',
    );
    expect(renderInlineMarkdown('[x](javascript:alert(1))')).toBe('[x](javascript:alert(1))');
    expect(safeMarkdownHref('javascript:alert(1)')).toBeNull();
    expect(safeMarkdownHref('https://a.b/c')).toBe('https://a.b/c');
  });

  it('转义 HTML 并保留换行', () => {
    expect(renderInlineMarkdown('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;');
    expect(renderInlineMarkdown('a\nb')).toBe('a<br/>b');
  });
});
