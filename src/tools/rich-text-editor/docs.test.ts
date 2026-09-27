import { describe, expect, it } from 'vitest';
import { buildTableOfContents, htmlToMarkdown } from './docs';

/** 目录生成与 HTML→Markdown 的纯逻辑单测 */

describe('buildTableOfContents', () => {
  it('按层级缩进输出标题与页码', () => {
    const result = buildTableOfContents(
      [
        { level: 1, text: '引言' },
        { level: 2, text: '背景' },
        { level: 3, text: '细节' },
      ],
      (index) => index + 1,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries.map((e) => [e.level, e.page])).toEqual([
        [1, 1],
        [2, 2],
        [3, 3],
      ]);
      expect(result.value.text.split('\n')[2]).toBe('\t\t细节\t3');
    }
  });

  it('无标题时返回 EMPTY', () => {
    const result = buildTableOfContents([], () => 0);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe('EMPTY');
  });

  it('层级越界会被裁剪到 1-6', () => {
    const result = buildTableOfContents([{ level: 9, text: 'x' }], () => 0);
    expect(result.ok && result.value.entries[0].level).toBe(6);
  });
});

describe('htmlToMarkdown', () => {
  it('标题 / 强调 / 列表 / 引用 / 代码', () => {
    const md = htmlToMarkdown(
      '<h1>标题</h1><p><strong>粗</strong>与<em>斜</em>与<s>删</s></p><ul><li>一</li><li>二</li></ul><ol><li>甲</li></ol><blockquote>引用</blockquote><pre>code</pre><hr>',
    );
    expect(md).toContain('# 标题');
    expect(md).toContain('**粗**');
    expect(md).toContain('*斜*');
    expect(md).toContain('~~删~~');
    expect(md).toContain('- 一');
    expect(md).toContain('1. 甲');
    expect(md).toContain('> 引用');
    expect(md).toContain('```');
    expect(md).toContain('---');
  });

  it('任务清单输出复选框标记', () => {
    const md = htmlToMarkdown(
      '<ul data-type="taskList"><li data-checked="true">完成</li><li data-checked="false">待办</li></ul>',
    );
    expect(md).toContain('- [x] 完成');
    expect(md).toContain('- [ ] 待办');
  });

  it('表格输出 GFM 表格', () => {
    const md = htmlToMarkdown(
      '<table><tr><th>姓名</th><th>年龄</th></tr><tr><td>张三</td><td>18</td></tr></table>',
    );
    expect(md).toContain('| 姓名 | 年龄 |');
    expect(md).toContain('| --- | --- |');
    expect(md).toContain('| 张三 | 18 |');
  });

  it('链接与图片', () => {
    const md = htmlToMarkdown('<p><a href="https://a.b">链接</a><img src="x.png" alt="图"></p>');
    expect(md).toContain('[链接](https://a.b)');
    expect(md).toContain('![图](x.png)');
  });
});
