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
 * Footnote tests:
 * - A reference is an inline atom (the note body lives in node attributes), self-contained in one node;
 * - The on-screen summary is a widget at the end of the document; injectFootnotes numbers and injects it before export;
 * - Numbering follows traversal order; stale numbers in the HTML are never trusted.
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
  it('collects notes in document order and trims whitespace', () => {
    const editor = createEditor('<p>甲<sup data-footnote data-note="  第一条  "></sup>乙</p>');
    // Move the cursor to the end before inserting, proving order follows position, not insertion time
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertFootnote('第二条');
    expect(collectFootnoteNotes(editor.state.doc)).toEqual(['第一条', '第二条']);
  });

  it('returns an empty array when there are no footnotes', () => {
    const editor = createEditor('<p>正文</p>');
    expect(collectFootnoteNotes(editor.state.doc)).toEqual([]);
  });
});

describe('renderFootnoteList', () => {
  it('renders a numbered summary and shows placeholder copy for empty notes', () => {
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
  it('numbers by DOM order and appends the summary', () => {
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

  it('does not accumulate summaries on repeated calls and renumbers them', () => {
    const once = injectFootnotes('<p>甲<sup data-footnote data-note="A"></sup></p>', LABELS);
    const twice = injectFootnotes(
      `${once}<p>乙<sup data-footnote data-note="B"></sup></p>`,
      LABELS,
    );
    expect((twice.match(/data-footnote-list="true"/g) ?? []).length).toBe(1);
    expect(twice).toContain('data-number="2"');
  });

  it('returns the input unchanged when there are no footnote references', () => {
    const html = '<p>只有正文</p>';
    expect(injectFootnotes(html, LABELS)).toBe(html);
  });

  it('keeps data-note on references so Word export can read it', () => {
    const html = injectFootnotes('<p>甲<sup data-footnote data-note="保留我"></sup></p>', LABELS);
    expect(html).toContain('data-note="保留我"');
  });
});

describe('footnote node commands', () => {
  it('writes data-footnote and data-note into the serialized HTML', () => {
    const editor = createEditor('<p>正文</p>');
    editor.commands.insertFootnote('引用来源');
    const html = editor.getHTML();
    expect(html).toContain('data-footnote="true"');
    expect(html).toContain('data-note="引用来源"');
  });

  it('re-parses that HTML as footnote nodes and keeps the note body', () => {
    const editor = createEditor('<p>正文<sup data-footnote="true" data-note="来源"></sup></p>');
    const notes = collectFootnoteNotes(editor.state.doc);
    expect(notes).toEqual(['来源']);
  });

  it('findSelectedFootnote locates the reference next to the cursor', () => {
    const editor = createEditor('<p>正文</p>');
    editor.commands.insertFootnote('一条注释');
    // After insertion the cursor sits right after the reference, the usual shape of "continue editing this note"
    const found = findSelectedFootnote(editor.state);
    expect(found?.note).toBe('一条注释');
    // Also works when the reference itself is selected
    const pos = found?.pos ?? 0;
    editor.commands.setNodeSelection(pos);
    expect(findSelectedFootnote(editor.state)?.pos).toBe(pos);
  });

  it('updateFootnote / removeFootnote edit the reference at a position', () => {
    const editor = createEditor('<p>正文</p>');
    editor.commands.insertFootnote('旧内容');
    const pos = findSelectedFootnote(editor.state)?.pos ?? -1;
    expect(pos).toBeGreaterThan(0);
    expect(editor.commands.updateFootnote(pos, '新内容')).toBe(true);
    expect(collectFootnoteNotes(editor.state.doc)).toEqual(['新内容']);
    expect(editor.commands.removeFootnote(pos)).toBe(true);
    expect(collectFootnoteNotes(editor.state.doc)).toEqual([]);
  });

  it('returns false when the command targets a non-footnote position', () => {
    const editor = createEditor('<p>正文</p>');
    expect(editor.commands.updateFootnote(0, 'x')).toBe(false);
    expect(editor.commands.removeFootnote(0)).toBe(false);
  });

  it('renders the summary widget at the end of the document on screen', () => {
    const editor = createEditor('<p>正文</p>');
    expect(editor.view.dom.querySelector('.rte-footnote-list')).toBeNull();
    editor.commands.insertFootnote('屏幕可见');
    const list = editor.view.dom.querySelector('.rte-footnote-list');
    expect(list).not.toBeNull();
    expect(list?.textContent ?? '').toContain('屏幕可见');
  });
});
