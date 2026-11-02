import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { bookmarkNames, collectBookmarks } from './bookmarks';
import { createExtensions } from './extensions';
import {
  collectXrefs,
  countBrokenXrefs,
  findXrefTarget,
  injectXrefHtml,
  resolveAllXrefs,
  resolveXrefValue,
  xrefKey,
} from './xrefs';

/** 交叉引用（RTE-03 第二批）：目标解析、命令、导出注入与失效检测 */

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

/** 在段落开头放一个书签，返回它的位置 */
function bookmarkAtStart(editor: Editor, name: string): number {
  editor.commands.setTextSelection(2);
  editor.chain().insertBookmark(name).run();
  const entry = collectBookmarks(editor.state.doc).find((item) => item.name === name);
  if (!entry) throw new Error('bookmark not inserted');
  return entry.pos;
}

describe('xref target resolution', () => {
  it('takes the text of the paragraph that holds the bookmark', () => {
    const editor = createEditor('<p>图 1 系统架构</p>');
    bookmarkAtStart(editor, 'Fig1');
    expect(findXrefTarget(editor.state.doc, 'Fig1')?.text).toBe('图 1 系统架构');
  });

  it('returns null for a bookmark that does not exist', () => {
    const editor = createEditor('<p>abc</p>');
    expect(findXrefTarget(editor.state.doc, 'Nope')).toBeNull();
    expect(resolveXrefValue(editor.state.doc, 'Nope', 'page', () => 1)).toBeNull();
  });

  it('resolves the page number through the pagination callback', () => {
    const editor = createEditor('<p>abc</p>');
    bookmarkAtStart(editor, 'Here');
    expect(resolveXrefValue(editor.state.doc, 'Here', 'page', () => 7)).toBe('7');
    // 没有分页状态（pageIndexOfPos 返回 0）时不能显示 "第 0 页"
    expect(resolveXrefValue(editor.state.doc, 'Here', 'page', () => 0)).toBeNull();
  });
});

describe('xref commands', () => {
  it('inserts a reference to an existing bookmark', () => {
    const editor = createEditor('<p>见 此处</p>');
    bookmarkAtStart(editor, 'Here');
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    expect(editor.chain().insertCrossReference('Here', 'text').run()).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain('data-xref="Here"');
    expect(html).toContain('data-xref-mode="text"');
    // 引用是零宽的 atom：正文文字不能被替换掉
    expect(editor.state.doc.textContent).toContain('见 此处');
  });

  it('refuses to reference a missing bookmark', () => {
    const editor = createEditor('<p>abc</p>');
    editor.commands.setTextSelection(1);
    expect(editor.chain().insertCrossReference('Ghost', 'text').run()).toBe(false);
    expect(collectXrefs(editor.state.doc)).toHaveLength(0);
  });

  it('deletes a reference without touching the text', () => {
    const editor = createEditor('<p>ab</p>');
    bookmarkAtStart(editor, 'Here');
    editor.commands.setTextSelection(2);
    editor.chain().insertCrossReference('Here', 'page').run();
    const [entry] = collectXrefs(editor.state.doc);
    expect(entry.mode).toBe('page');
    expect(editor.chain().removeCrossReference(entry.pos).run()).toBe(true);
    expect(collectXrefs(editor.state.doc)).toHaveLength(0);
    expect(editor.state.doc.textContent).toBe('ab');
  });

  it('counts references whose bookmark was deleted', () => {
    const editor = createEditor('<p>ab</p>');
    bookmarkAtStart(editor, 'Temp');
    editor.commands.setTextSelection(2);
    editor.chain().insertCrossReference('Temp', 'text').run();
    expect(countBrokenXrefs(editor.state.doc)).toBe(0);
    // 插引用会把书签往后推，位置必须重新取一次（旧 pos 会落到引用节点上）
    const current = collectBookmarks(editor.state.doc)[0];
    expect(editor.chain().removeBookmark(current.pos).run()).toBe(true);
    expect(countBrokenXrefs(editor.state.doc)).toBe(1);
    expect(bookmarkNames(editor.state.doc)).toEqual([]);
  });
});

describe('xref export injection', () => {
  it('fills the serialized empty shell with the resolved value', () => {
    const editor = createEditor('<p>图 2 数据流</p>');
    bookmarkAtStart(editor, 'Fig2');
    editor.commands.setTextSelection(2);
    editor.chain().insertCrossReference('Fig2', 'text').run();
    const values = resolveAllXrefs(editor.state.doc, () => 1);
    expect(values.get(xrefKey('Fig2', 'text'))).toBe('图 2 数据流');
    const injected = injectXrefHtml(editor.getHTML(), values);
    expect(injected).toContain('图 2 数据流');
    // 标记属性必须保留：docx 导出要靠它决定写域还是写链接
    expect(injected).toContain('data-xref="Fig2"');
  });

  it('renders the missing label for a dangling reference', () => {
    const html = '<p><span class="rte-xref" data-xref="Gone" data-xref-mode="page"></span></p>';
    const injected = injectXrefHtml(html, new Map(), { missing: '引用失效' });
    expect(injected).toContain('引用失效');
    expect(injected).toContain('rte-xref-missing');
  });

  it('leaves html without references untouched', () => {
    const html = '<p>abc</p>';
    expect(injectXrefHtml(html, new Map())).toBe(html);
  });
});
