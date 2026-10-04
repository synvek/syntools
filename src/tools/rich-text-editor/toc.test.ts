import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createExtensions } from './extensions';
import {
  buildTocEntries,
  collectHeadings,
  injectTocHtml,
  renderTocElement,
  renderTocHtml,
} from './toc';

/**
 * 动态目录测试：
 * - 标题收集与页码计算（含层级裁剪）
 * - 编辑态 / 导出态共用的 DOM 结构（屏幕、打印、快照、Markdown、Word 五端都按这套属性识别）
 * - atom 节点序列化为空外壳，导出前必须由 injectTocHtml 补齐
 */

const LABELS = { title: '目录', empty: '文档暂无标题' };
const editors: Editor[] = [];

function createEditor(content: string): Editor {
  const editor = new Editor({
    extensions: createExtensions({ placeholder: '输入内容…' }),
    content,
  });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe('collectHeadings', () => {
  it('收集标题文本、层级与文档位置', () => {
    const editor = createEditor('<h1>引言</h1><p>正文</p><h2>背景</h2>');
    const headings = collectHeadings(editor.state.doc);
    expect(headings.map((heading) => [heading.level, heading.text])).toEqual([
      [1, '引言'],
      [2, '背景'],
    ]);
    expect(headings[0].pos).toBeLessThan(headings[1].pos);
  });

  it('跳过没有文字的标题，保证与目录条目一一对应', () => {
    const editor = createEditor('<h1></h1><h1>有内容</h1>');
    expect(collectHeadings(editor.state.doc).map((heading) => heading.text)).toEqual(['有内容']);
  });
});

describe('buildTocEntries', () => {
  it('页码由回调按标题位置实时给出，层级裁剪到 1-6', () => {
    const editor = createEditor('<h1>一</h1><h2>二</h2>');
    const headings = collectHeadings(editor.state.doc);
    const { entries } = buildTocEntries(editor.state.doc, (pos) => (pos < headings[1].pos ? 1 : 3));
    expect(entries.map((entry) => [entry.level, entry.text, entry.page])).toEqual([
      [1, '一', 1],
      [2, '二', 3],
    ]);
  });

  it('没有标题时返回空条目', () => {
    const editor = createEditor('<p>只有正文</p>');
    expect(buildTocEntries(editor.state.doc, () => 1).entries).toEqual([]);
  });
});

describe('renderTocElement / renderTocHtml', () => {
  const entries = [
    { level: 1, text: '引言', page: 1 },
    { level: 3, text: '细节', page: 2 },
  ];
  const headings = [
    { level: 1, text: '引言', pos: 4 },
    { level: 3, text: '细节', pos: 40 },
  ];

  it('导出态输出静态结构（span + 内联缩进 + 页码）', () => {
    const element = renderTocElement(entries, headings, LABELS);
    expect(element.getAttribute('data-toc')).toBe('true');
    expect(element.querySelector('.rte-toc-title')?.textContent).toBe('目录');
    const items = Array.from(element.querySelectorAll<HTMLLIElement>('li[data-level]'));
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('.rte-toc-text')?.tagName).toBe('SPAN');
    expect(items[0].style.paddingLeft).toBe('0px');
    expect(items[1].style.paddingLeft).toBe('32px');
    expect(items[1].querySelector('.rte-toc-page')?.textContent).toBe('2');
    // 导出态不写入跳转信息
    expect(items[0].hasAttribute('data-pos')).toBe(false);
  });

  it('编辑态输出可点击按钮并带目标位置', () => {
    const jumps: number[] = [];
    const element = renderTocElement(entries, headings, LABELS, (pos) => jumps.push(pos));
    const items = Array.from(element.querySelectorAll<HTMLLIElement>('li[data-level]'));
    expect(items[0].getAttribute('data-pos')).toBe('4');
    const button = items[1].querySelector('button.rte-toc-text');
    expect(button).not.toBeNull();
    (button as HTMLButtonElement).click();
    expect(jumps).toEqual([40]);
  });

  it('没有标题时渲染空状态提示', () => {
    const element = renderTocElement([], [], LABELS);
    expect(element.querySelector('.rte-toc-list')).toBeNull();
    expect(element.querySelector('.rte-toc-empty')?.textContent).toBe('文档暂无标题');
  });

  it('renderTocHtml 返回可直接注入的 HTML 字符串', () => {
    const html = renderTocHtml(entries, headings, LABELS);
    expect(html).toContain('data-toc="true"');
    expect(html).toContain('引言');
  });
});

describe('injectTocHtml', () => {
  it('把空目录节点替换为渲染内容', () => {
    const html = injectTocHtml(
      '<p>前</p><div data-toc="true" class="rte-toc"></div><p>后</p>',
      renderTocHtml(
        [{ level: 1, text: '引言', page: 2 }],
        [{ level: 1, text: '引言', pos: 4 }],
        LABELS,
      ),
    );
    expect(html).toContain('rte-toc-list');
    expect(html).toContain('引言');
    expect(html).toContain('>2<');
    // 目录节点保留 data-toc，Word 导出仍能识别
    expect(html).toContain('data-toc="true"');
  });

  it('没有目录节点或渲染结果时原样返回', () => {
    const html = '<p>只有正文</p>';
    expect(injectTocHtml(html, '<div data-toc="true"></div>')).toBe(html);
    expect(injectTocHtml('<div data-toc="true"></div>', '')).toBe('<div data-toc="true"></div>');
  });

  it('多个目录节点都会被补齐', () => {
    const html = injectTocHtml(
      '<div data-toc="true"></div><div data-toc="true"></div>',
      renderTocHtml([], [], LABELS),
    );
    expect((html.match(/rte-toc-empty/g) ?? []).length).toBe(2);
  });
});

describe('目录节点命令', () => {
  it('插入后序列化为带 data-toc 的空外壳（atom）', () => {
    const editor = createEditor('<h1>引言</h1>');
    editor.commands.insertTableOfContents();
    const html = editor.getHTML();
    expect(html).toContain('data-toc="true"');
    // atom 节点不携带内容：导出前必须走 injectTocHtml
    expect(html).not.toContain('rte-toc-list');
  });

  it('再次解析该 HTML 仍识别为目录节点', () => {
    const editor = createEditor(
      '<h1>引言</h1><div data-toc="true" class="rte-toc"><p class="rte-toc-title">目录</p></div>',
    );
    let count = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'tableOfContents') count += 1;
    });
    expect(count).toBe(1);
  });

  it('refreshTableOfContents 触发一次事务', () => {
    const editor = createEditor('<h1>引言</h1>');
    let updates = 0;
    editor.on('update', () => {
      updates += 1;
    });
    expect(editor.commands.refreshTableOfContents()).toBe(true);
    expect(updates).toBe(1);
  });
});
