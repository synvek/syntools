import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DocBookmark,
  bookmarkNames,
  collectBookmarks,
  findSelectedBookmark,
  normalizeBookmarkName,
  uniqueBookmarkName,
} from './bookmarks';

/** 书签（RTE-03）：命名规则、命令、HTML 往返与选区内定位 */

const editors: Editor[] = [];

function createEditor(content: string): Editor {
  const editor = new Editor({ extensions: [StarterKit, DocBookmark], content });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  while (editors.length > 0) editors.pop()?.destroy();
});

describe('normalizeBookmarkName', () => {
  it('keeps letters, digits, underscores and hyphens', () => {
    expect(normalizeBookmarkName('Intro_1-a')).toBe('Intro_1-a');
  });

  it('turns whitespace into underscores instead of dropping the word boundary', () => {
    expect(normalizeBookmarkName('我的 书签')).toBe('我的_书签');
  });

  it('drops characters Word would reject', () => {
    expect(normalizeBookmarkName('a<b>c/d')).toBe('abcd');
  });

  it('prefixes names that do not start with a letter', () => {
    expect(normalizeBookmarkName('2026计划')).toBe('bm_2026计划');
  });

  it('truncates to the Word limit', () => {
    expect(normalizeBookmarkName('x'.repeat(60))).toHaveLength(40);
  });

  it('returns null when nothing usable is left', () => {
    expect(normalizeBookmarkName('   ')).toBeNull();
    expect(normalizeBookmarkName('<>/')).toBeNull();
  });
});

describe('uniqueBookmarkName', () => {
  it('keeps the base name when it is free', () => {
    expect(uniqueBookmarkName('图1', [])).toBe('图1');
  });

  it('appends a numeric suffix while keeping the length limit', () => {
    expect(uniqueBookmarkName('图1', ['图1'])).toBe('图1_2');
    expect(uniqueBookmarkName('图1', ['图1', '图1_2'])).toBe('图1_3');
  });
});

describe('bookmark node', () => {
  it('inserts a zero-width anchor at the cursor', () => {
    const editor = createEditor('<p>abc</p>');
    editor.commands.setTextSelection(2);
    expect(editor.chain().insertBookmark('Chapter1').run()).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain('data-bookmark="Chapter1"');
    // 零宽：不能把原文字挤开
    expect(editor.state.doc.textContent).toBe('abc');
  });

  it('rejects empty and duplicate names', () => {
    const editor = createEditor('<p>abc</p>');
    editor.commands.setTextSelection(2);
    expect(editor.chain().insertBookmark('  ').run()).toBe(false);
    expect(editor.chain().insertBookmark('Same').run()).toBe(true);
    editor.commands.setTextSelection(3);
    expect(editor.chain().insertBookmark('Same').run()).toBe(false);
  });

  it('collects bookmarks in document order', () => {
    const editor = createEditor('<p>a</p><p>b</p>');
    editor.commands.setTextSelection(2);
    editor.chain().insertBookmark('Second').run();
    editor.commands.setTextSelection(1);
    editor.chain().insertBookmark('First').run();
    expect(bookmarkNames(editor.state.doc)).toEqual(['First', 'Second']);
  });

  it('renames a bookmark and refuses to collide with another one', () => {
    const editor = createEditor('<p>ab</p>');
    editor.commands.setTextSelection(1);
    editor.chain().insertBookmark('One').run();
    editor.commands.setTextSelection(2);
    editor.chain().insertBookmark('Two').run();
    const [first, second] = collectBookmarks(editor.state.doc);
    expect(editor.chain().updateBookmark(first.pos, 'Two').run()).toBe(false);
    expect(editor.chain().updateBookmark(first.pos, 'Uno').run()).toBe(true);
    expect(bookmarkNames(editor.state.doc)).toEqual(['Uno', 'Two']);
    expect(second.name).toBe('Two');
  });

  it('deletes a bookmark without touching the text', () => {
    const editor = createEditor('<p>abc</p>');
    editor.commands.setTextSelection(2);
    editor.chain().insertBookmark('Gone').run();
    const [entry] = collectBookmarks(editor.state.doc);
    expect(editor.chain().removeBookmark(entry.pos).run()).toBe(true);
    expect(bookmarkNames(editor.state.doc)).toEqual([]);
    expect(editor.state.doc.textContent).toBe('abc');
  });

  it('parses its own HTML back (draft save / load)', () => {
    const editor = createEditor('<p>a<a data-bookmark="Keep"></a>b</p>');
    expect(bookmarkNames(editor.state.doc)).toEqual(['Keep']);
    expect(editor.getHTML()).toContain('data-bookmark="Keep"');
  });

  it('reads the empty anchor mammoth produces for w:bookmarkStart', () => {
    const editor = createEditor('<p>a<a id="Intro"></a>b</p>');
    expect(bookmarkNames(editor.state.doc)).toEqual(['Intro']);
  });

  it('leaves real hyperlinks alone', () => {
    const editor = createEditor('<p><a href="https://example.com">x</a></p>');
    expect(bookmarkNames(editor.state.doc)).toEqual([]);
    expect(editor.getHTML()).toContain('href="https://example.com"');
  });

  it('finds the bookmark the caret sits next to', () => {
    const editor = createEditor('<p>abc</p>');
    editor.commands.setTextSelection(2);
    editor.chain().insertBookmark('Beside').run();
    editor.commands.setTextSelection(2);
    expect(findSelectedBookmark(editor.state)?.name).toBe('Beside');
  });
});
