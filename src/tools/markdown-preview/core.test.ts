import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MARKDOWN_OPTIONS,
  applyHeadingIds,
  buildHtmlDocument,
  countMarkdownStats,
  extractOutline,
  renderMarkdown,
  sanitizeFilename,
  withExtension,
} from './core';

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

describe('countMarkdownStats', () => {
  it('中英混排字数与行数', () => {
    const stats = countMarkdownStats('hello world\n你好世界');
    expect(stats.words).toBe(2 + 4);
    expect(stats.lines).toBe(2);
    expect(stats.characters).toBe('hello world\n你好世界'.length);
    expect(stats.readingMinutes).toBe(1);
  });

  it('空文本各项归零', () => {
    expect(countMarkdownStats('')).toEqual({
      characters: 0,
      words: 0,
      lines: 0,
      readingMinutes: 0,
    });
  });

  it('长文按 300 字/分钟估算', () => {
    expect(countMarkdownStats('字'.repeat(601)).readingMinutes).toBe(3);
  });
});

describe('extractOutline / applyHeadingIds', () => {
  it('提取标题层级与源码偏移', () => {
    const outline = extractOutline('# 一\n\n## 二\n');
    expect(outline.map((item) => [item.level, item.text])).toEqual([
      [1, '一'],
      [2, '二'],
    ]);
    expect(outline[0].offset).toBe(0);
    expect(outline[1].offset).toBe('# 一\n\n'.length);
    expect(outline.map((item) => item.id)).toEqual(['md-h-1', 'md-h-2']);
  });

  it('围栏代码块内的 # 不算标题', () => {
    const outline = extractOutline('# 标题\n\n```sh\n# 注释\n```\n');
    expect(outline).toHaveLength(1);
    expect(outline[0].text).toBe('标题');
  });

  it('锚点 id 与大纲顺序一致', () => {
    const html = applyHeadingIds('<h1>A</h1><p>x</p><h2>B</h2>');
    expect(html).toBe('<h1 id="md-h-1">A</h1><p>x</p><h2 id="md-h-2">B</h2>');
  });
});

describe('文件名与导出', () => {
  it('清洗非法字符并回落默认名', () => {
    expect(sanitizeFilename('a/b:c*d?.md')).toBe('abcd.md');
    expect(sanitizeFilename('   ')).toBe('untitled');
    expect(sanitizeFilename('..hidden')).toBe('hidden');
  });

  it('补扩展名不重复', () => {
    expect(withExtension('note', '.md')).toBe('note.md');
    expect(withExtension('note.md', '.md')).toBe('note.md');
    expect(withExtension('note.md', '.html')).toBe('note.md.html');
  });

  it('导出 HTML 转义标题且内嵌样式', () => {
    const doc = buildHtmlDocument('<x>', '<h1 id="md-h-1">T</h1>');
    expect(doc).toContain('<title>&lt;x&gt;</title>');
    expect(doc).toContain('<h1 id="md-h-1">T</h1>');
    expect(doc).toContain('markdown-body');
    expect(doc).not.toContain('<script');
  });
});
