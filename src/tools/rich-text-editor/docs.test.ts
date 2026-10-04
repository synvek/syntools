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

  it('下划线 / 高亮 / 修订插入以 GFM 内联 HTML 保留', () => {
    const md = htmlToMarkdown(
      '<p><u>下划线</u><mark>高亮</mark><ins data-track="insert">新增</ins><ins>普通插入</ins></p>',
    );
    expect(md).toContain('<u>下划线</u>');
    expect(md).toContain('<mark>高亮</mark>');
    expect(md).toContain('<ins>新增</ins>');
    expect(md).toContain('<ins>普通插入</ins>');
  });

  it('记入白名单的行内样式保留，其余样式丢弃', () => {
    const md = htmlToMarkdown(
      '<p><span style="color: rgb(255, 0, 0); font-size: 20px; padding: 4px">彩色</span></p>',
    );
    expect(md).toContain('color: rgb(255, 0, 0)');
    expect(md).toContain('font-size: 20px');
    expect(md).not.toContain('padding');
  });

  it('批注标记丢弃但保留文本', () => {
    const md = htmlToMarkdown('<p>前<span data-comment-id="c-1">待审</span>后</p>');
    expect(md).toContain('前待审后');
    expect(md).not.toContain('data-comment-id');
  });

  it('分页符输出可还原的 HTML 注释', () => {
    const md = htmlToMarkdown('<p>第一页</p><div data-page-break="true"></div><p>第二页</p>');
    expect(md).toContain('<!-- page-break -->');
    expect(md.indexOf('第一页')).toBeLessThan(md.indexOf('<!-- page-break -->'));
    expect(md.indexOf('<!-- page-break -->')).toBeLessThan(md.indexOf('第二页'));
  });

  it('目录展开为带层级缩进与页码的列表', () => {
    const md = htmlToMarkdown(
      '<div data-toc="true" class="rte-toc"><p class="rte-toc-title">目录</p><ul class="rte-toc-list">' +
        '<li data-level="1"><span class="rte-toc-text">引言</span><span class="rte-toc-page">1</span></li>' +
        '<li data-level="2"><span class="rte-toc-text">背景</span><span class="rte-toc-page">2</span></li>' +
        '</ul></div>',
    );
    expect(md).toContain('**目录**');
    expect(md).toContain('- 引言 … 1');
    expect(md).toContain('  - 背景 … 2');
  });

  it('空目录不产生任何输出', () => {
    const md = htmlToMarkdown('<div data-toc="true" class="rte-toc"></div><p>正文</p>');
    expect(md).toBe('正文');
  });

  it('脚注上标与汇总区展开为编号列表', () => {
    const md = htmlToMarkdown(
      '<p>结论<sup data-footnote="true" data-note="来源" data-number="1">[1]</sup></p>' +
        '<section class="rte-footnote-list" data-footnote-list="true">' +
        '<p class="rte-footnote-list-title">脚注</p><ol><li>来源</li></ol></section>',
    );
    expect(md).toContain('结论[1]');
    expect(md).toContain('**脚注**');
    expect(md).toContain('1. 来源');
  });
});
