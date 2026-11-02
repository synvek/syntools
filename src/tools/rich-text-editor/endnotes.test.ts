import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { injectFootnotes } from './footnotes';
import {
  collectEndnoteNotes,
  findSelectedEndnote,
  injectEndnotes,
  renderEndnoteList,
} from './endnotes';
import { createExtensions } from './extensions';

/** 尾注（RTE-03 收口）：独立编号、命令、导出注入与汇总渲染 */

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
  while (editors.length > 0) editors.pop()?.destroy();
});

describe('endnote commands', () => {
  it('inserts, updates and removes an endnote reference', () => {
    const editor = createEditor('<p>abc</p>');
    editor.commands.setTextSelection(2);
    expect(editor.chain().insertEndnote('第一条尾注').run()).toBe(true);
    expect(collectEndnoteNotes(editor.state.doc)).toEqual(['第一条尾注']);
    expect(editor.getHTML()).toContain('data-endnote');

    const selected = findSelectedEndnote(editor.state);
    expect(selected?.note).toBe('第一条尾注');
    if (!selected) return;

    expect(editor.chain().updateEndnote(selected.pos, '改过的尾注').run()).toBe(true);
    expect(collectEndnoteNotes(editor.state.doc)).toEqual(['改过的尾注']);

    expect(editor.chain().removeEndnote(selected.pos).run()).toBe(true);
    expect(collectEndnoteNotes(editor.state.doc)).toEqual([]);
    // 引用是 atom，删除后正文一个字都不能少
    expect(editor.state.doc.textContent).toBe('abc');
  });

  it('parses its own HTML back', () => {
    const editor = createEditor(
      '<p>a<sup class="rte-endnote-ref" data-endnote="true" data-note="注"></sup>b</p>',
    );
    expect(collectEndnoteNotes(editor.state.doc)).toEqual(['注']);
    expect(editor.getHTML()).toContain('data-endnote');
  });
});

describe('endnote numbering', () => {
  it('numbers from 1 independently of footnotes', () => {
    const html =
      '<p>正文<sup data-footnote="true" data-note="脚注一"></sup>' +
      '<sup data-endnote="true" data-note="尾注一"></sup>' +
      '<sup data-endnote="true" data-note="尾注二"></sup></p>';
    const endnotes = injectEndnotes(html);
    expect(endnotes).toContain('data-number="1"');
    expect(endnotes).toContain('data-number="2"');
    expect(endnotes).toContain('[2]');
    // 脚注的引用不能被尾注注入改写
    expect(endnotes).not.toContain('data-footnote="true" data-number');
    const footnotes = injectFootnotes(html);
    expect(footnotes).toContain('[1]');
    expect(footnotes).not.toContain('[2]');
  });

  it('replaces the previous summary instead of appending a second one', () => {
    const html = '<p>a<sup data-endnote="true" data-note="注"></sup></p>';
    const once = injectEndnotes(html);
    const twice = injectEndnotes(once);
    expect(twice.split('data-endnote-list').length - 1).toBe(1);
  });
});

describe('endnote summary', () => {
  it('renders title, ordered items and the empty placeholder', () => {
    const section = renderEndnoteList(['第一条', '']);
    expect(section.getAttribute('data-endnote-list')).toBe('true');
    expect(section.querySelector('.rte-endnote-list-title')?.textContent).toBe('尾注');
    const items = Array.from(section.querySelectorAll('.rte-endnote-item'));
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('第一条');
    expect(items[1].textContent).toBe('（空尾注）');
  });

  it('leaves documents without endnotes untouched', () => {
    const html = '<p>abc</p>';
    expect(injectEndnotes(html)).toBe(html);
  });
});
