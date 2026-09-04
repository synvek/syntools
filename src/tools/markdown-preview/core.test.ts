import { describe, expect, it } from 'vitest';
import { DEFAULT_MARKDOWN_OPTIONS, renderMarkdown } from './core';

const ok = (text: string, options = DEFAULT_MARKDOWN_OPTIONS): string => {
  const result = renderMarkdown(text, options);
  expect(result.ok).toBe(true);
  return result.ok ? result.value : '';
};

describe('renderMarkdown', () => {
  it('基础元素：标题 / 段落 / 强调 / 行内代码', () => {
    const html = ok('# 标题\n\n正文 **加粗** 与 `code`');
    expect(html).toContain('<h1>标题</h1>');
    expect(html).toContain('<strong>加粗</strong>');
    expect(html).toContain('<code>code</code>');
  });

  it('GFM：表格与删除线', () => {
    const html = ok('| a | b |\n| - | - |\n| 1 | 2 |\n\n~~gone~~');
    expect(html).toContain('<table>');
    expect(html).toContain('<del>gone</del>');
  });

  it('breaks 选项：换行符转 <br>', () => {
    expect(ok('a\nb', { gfm: true, breaks: false })).not.toContain('<br');
    expect(ok('a\nb', { gfm: true, breaks: true })).toContain('<br');
  });

  it('链接与图片保留合法属性', () => {
    const html = ok('[链接](https://example.com)\n\n![图](https://example.com/a.png)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('src="https://example.com/a.png"');
  });

  it('XSS：script 标签被剥离', () => {
    const html = ok('hello <script>alert(1)</script> world');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert');
  });

  it('XSS：事件属性与 javascript: 链接被清理', () => {
    expect(ok('<img src=x onerror="alert(1)">')).not.toContain('onerror');
    expect(ok('[x](javascript:alert(1))')).not.toContain('javascript:');
  });

  it('空输入返回 EMPTY', () => {
    expect(renderMarkdown('')).toEqual({ ok: false, error: 'EMPTY' });
    expect(renderMarkdown('   \n ')).toEqual({ ok: false, error: 'EMPTY' });
  });
});
