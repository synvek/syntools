import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createExtensions } from './extensions';
import {
  collectFootnoteNotes,
  findSelectedFootnote,
  injectFootnotes,
  renderFootnoteList,
  type FootnoteLabels,
} from './footnotes';

/**
 * 脚注测试：
 * - 引用是行内 atom（注释正文存在节点属性里），单节点自包含；
 * - 屏幕汇总区是文档末尾的 widget，导出前由 injectFootnotes 统一编号并注入汇总区；
 * - 编号的权威来源是遍历顺序，不信任 HTML 里的旧编号。
 */

const LABELS: FootnoteLabels = { name: '脚注', empty: '（空脚注）' };
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

describe('collectFootnoteNotes', () => {
  it('按文档顺序收集并裁剪空白', () => {
    const editor = createEditor('<p>甲<sup data-footnote data-note="  第一条  "></sup>乙</p>');
    // 光标移到段落末尾再插入，验证顺序按文档位置而非插入先后
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertFootnote('第二条');
    expect(collectFootnoteNotes(editor.state.doc)).toEqual(['第一条', '第二条']);
  });

  it('没有脚注时返回空数组', () => {
    const editor = createEditor('<p>正文</p>');
    expect(collectFootnoteNotes(editor.state.doc)).toEqual([]);
  });
});

describe('renderFootnoteList', () => {
  it('输出带编号的汇总区，空注释显示占位文案', () => {
    const element = renderFootnoteList(['第一条', ''], LABELS);
    expect(element.tagName).toBe('SECTION');
    expect(element.getAttribute('data-footnote-list')).toBe('true');
    expect(element.querySelector('.rte-footnote-list-title')?.textContent).toBe('脚注');
    const items = Array.from(element.querySelectorAll<HTMLLIElement>('.rte-footnote-item'));
    expect(items.map((item) => item.getAttribute('data-number'))).toEqual(['1', '2']);
    expect(items[0].textContent).toBe('第一条');
    expect(items[1].textContent).toBe('（空脚注）');
  });
});

describe('injectFootnotes', () => {
  it('按 DOM 顺序编号并追加汇总区', () => {
    const html = injectFootnotes(
      '<p>甲<sup data-footnote data-note="注释一"></sup>乙<sup data-footnote data-note="注释二"></sup></p>',
      LABELS,
    );
    expect(html).toContain('data-number="1"');
    expect(html).toContain('data-number="2"');
    expect(html).toContain('>[1]<');
    expect(html).toContain('>[2]<');
    expect(html).toContain('rte-footnote-list');
    expect(html).toContain('注释一');
    expect(html).toContain('注释二');
  });

  it('重复调用不会累积多个汇总区，并会重新编号', () => {
    const once = injectFootnotes('<p>甲<sup data-footnote data-note="A"></sup></p>', LABELS);
    const twice = injectFootnotes(
      `${once}<p>乙<sup data-footnote data-note="B"></sup></p>`,
      LABELS,
    );
    expect((twice.match(/data-footnote-list="true"/g) ?? []).length).toBe(1);
    expect(twice).toContain('data-number="2"');
  });

  it('没有脚注引用时原样返回', () => {
    const html = '<p>只有正文</p>';
    expect(injectFootnotes(html, LABELS)).toBe(html);
  });

  it('引用上的 data-note 会保留，供 Word 导出读取', () => {
    const html = injectFootnotes('<p>甲<sup data-footnote data-note="保留我"></sup></p>', LABELS);
    expect(html).toContain('data-note="保留我"');
  });
});

describe('脚注节点命令', () => {
  it('插入后在序列化 HTML 中带 data-footnote 与 data-note', () => {
    const editor = createEditor('<p>正文</p>');
    editor.commands.insertFootnote('引用来源');
    const html = editor.getHTML();
    expect(html).toContain('data-footnote="true"');
    expect(html).toContain('data-note="引用来源"');
  });

  it('再解析该 HTML 仍识别为脚注节点并保留注释正文', () => {
    const editor = createEditor('<p>正文<sup data-footnote="true" data-note="来源"></sup></p>');
    const notes = collectFootnoteNotes(editor.state.doc);
    expect(notes).toEqual(['来源']);
  });

  it('findSelectedFootnote 能定位光标紧邻的引用', () => {
    const editor = createEditor('<p>正文</p>');
    editor.commands.insertFootnote('一条注释');
    // 插入后光标停在引用之后，正是「继续编辑该脚注」的常见形态
    const found = findSelectedFootnote(editor.state);
    expect(found?.note).toBe('一条注释');
    // 引用本身被选中时同样能定位
    const pos = found?.pos ?? 0;
    editor.commands.setNodeSelection(pos);
    expect(findSelectedFootnote(editor.state)?.pos).toBe(pos);
  });

  it('updateFootnote / removeFootnote 修改指定位置的引用', () => {
    const editor = createEditor('<p>正文</p>');
    editor.commands.insertFootnote('旧内容');
    const pos = findSelectedFootnote(editor.state)?.pos ?? -1;
    expect(pos).toBeGreaterThan(0);
    expect(editor.commands.updateFootnote(pos, '新内容')).toBe(true);
    expect(collectFootnoteNotes(editor.state.doc)).toEqual(['新内容']);
    expect(editor.commands.removeFootnote(pos)).toBe(true);
    expect(collectFootnoteNotes(editor.state.doc)).toEqual([]);
  });

  it('对非脚注位置执行命令返回 false', () => {
    const editor = createEditor('<p>正文</p>');
    expect(editor.commands.updateFootnote(0, 'x')).toBe(false);
    expect(editor.commands.removeFootnote(0)).toBe(false);
  });

  it('屏幕端在文档末尾渲染汇总区 widget', () => {
    const editor = createEditor('<p>正文</p>');
    expect(editor.view.dom.querySelector('.rte-footnote-list')).toBeNull();
    editor.commands.insertFootnote('屏幕可见');
    const list = editor.view.dom.querySelector('.rte-footnote-list');
    expect(list).not.toBeNull();
    expect(list?.textContent ?? '').toContain('屏幕可见');
  });
});
