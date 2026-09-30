import { describe, expect, it } from 'vitest';
import { escapeHtml, highlightCode } from './prism';

describe('highlightCode', () => {
  it('空文本返回空串（注入填充字符会污染编辑区内容与导出文件）', () => {
    expect(highlightCode('', 'java')).toBe('');
    expect(highlightCode('', 'none')).toBe('');
  });

  it('`none` 或未知语法仅做转义', () => {
    expect(highlightCode('<a & b>', 'none')).toBe('&lt;a &amp; b&gt;');
    expect(highlightCode('<a & b>', 'not-a-language')).toBe('&lt;a &amp; b&gt;');
    expect(escapeHtml('"<&>"')).toBe('"&lt;&amp;&gt;"');
  });

  it('已知语法产出 token 标记且保留原文', () => {
    const html = highlightCode('const a = 1;', 'javascript');
    expect(html).toContain('token');
    expect(html.replace(/<[^>]+>/g, '')).toBe('const a = 1;');
  });
});
