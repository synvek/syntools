import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createExtensions } from './extensions';
import { DEFAULT_PAGE_SETUP, resolvePageMetrics } from './pageSetup';
import type { TrackingEntry } from './tracking';

/** P1-2 第一片：修订模式（输入 / 删除自动记录为可接受-拒绝的修订） */

function setup(content: string) {
  const state = { enabled: false, entries: [] as TrackingEntry[] };
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: createExtensions({
      placeholder: '输入内容…',
      onLayout: () => {},
      getPageMetrics: () => resolvePageMetrics(DEFAULT_PAGE_SETUP),
      tracking: {
        isEnabled: () => state.enabled,
        onChange: (entries) => state.entries.push(...entries),
      },
    }),
    content,
  });
  return { editor, state };
}

const text = (editor: Editor): string =>
  editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n').replace(/\s+/g, ' ').trim();

/** Type at the end of the document the way the browser does: one ReplaceStep per dispatch */
function type(editor: Editor, value: string): void {
  editor.commands.focus('end');
  editor.view.dispatch(editor.state.tr.insertText(value));
}

function erase(editor: Editor, from: number, to: number): void {
  editor.view.dispatch(editor.state.tr.delete(from, to));
}

describe('revision mode', () => {
  it('records nothing while the toggle is off', () => {
    const { editor, state } = setup('<p>abc</p>');
    type(editor, 'x');
    expect(text(editor)).toBe('abcx');
    expect(editor.getHTML()).not.toContain('<ins');
    expect(state.entries).toHaveLength(0);
    editor.destroy();
  });

  it('turns typed text into an insertion that can be rejected', () => {
    const { editor, state } = setup('<p>abc</p>');
    state.enabled = true;
    type(editor, 'x');

    expect(text(editor)).toBe('abcx');
    expect(editor.getHTML()).toContain('<ins');
    expect(editor.getHTML()).toContain('data-track="insert"');
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]).toMatchObject({ kind: 'insert', text: 'x' });

    editor.commands.rejectAllTracked();
    expect(text(editor)).toBe('abc');
    expect(editor.getHTML()).not.toContain('<ins');
    editor.destroy();
  });

  it('keeps deleted text behind a delete mark and drops it on accept', () => {
    const { editor, state } = setup('<p>hello world</p>');
    state.enabled = true;
    erase(editor, 1, 6);

    expect(text(editor)).toBe('hello world');
    expect(editor.getHTML()).toContain('<del');
    expect(editor.getHTML()).toContain('data-track="delete"');
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]).toMatchObject({ kind: 'delete', text: 'hello' });

    editor.commands.acceptAllTracked();
    expect(text(editor)).toBe('world');
    expect(editor.getHTML()).not.toContain('<del');
    editor.destroy();
  });

  it('records typing over a selection as one change with both halves', () => {
    const { editor, state } = setup('<p>hello world</p>');
    state.enabled = true;
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.view.dispatch(editor.state.tr.insertText('bye'));

    // One id for "replace": rejecting brings the old text back, accepting keeps only the new one
    expect(state.entries).toHaveLength(1);
    const html = editor.getHTML();
    expect(html).toContain('<del');
    expect(html).toContain('data-track="delete"');
    expect(html).toContain('<ins');
    expect(html).toContain('data-track="insert"');
    const ids = [...html.matchAll(/data-track-id="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(1);

    editor.commands.rejectAllTracked();
    expect(text(editor)).toBe('hello world');
    editor.destroy();
  });

  it('cancels out when text that is a pending insertion is deleted again', () => {
    const { editor, state } = setup('<p>abc</p>');
    state.enabled = true;
    type(editor, 'x');
    erase(editor, 4, 5);

    expect(text(editor)).toBe('abc');
    expect(editor.getHTML()).not.toContain('<del');
    // The typed revision is gone; no "x was deleted" revision is invented
    expect(state.entries).toHaveLength(1);
    editor.destroy();
  });

  it('leaves accept / reject alone instead of recording them as revisions', () => {
    const { editor, state } = setup('<p>hello world</p>');
    state.enabled = true;
    erase(editor, 1, 6);
    editor.commands.acceptAllTracked();

    expect(text(editor)).toBe('world');
    expect(editor.getHTML()).not.toContain('<del');
    expect(state.entries).toHaveLength(1);
    editor.destroy();
  });

  it('does not re-track undo (one keystroke stays one history step)', () => {
    const { editor, state } = setup('<p>abc</p>');
    state.enabled = true;
    type(editor, 'x');
    expect(text(editor)).toBe('abcx');

    editor.commands.undo();
    expect(text(editor)).toBe('abc');
    expect(editor.getHTML()).not.toContain('<del');
    editor.destroy();
  });

  it('leaves structural edits untouched instead of half-tracking them', () => {
    const { editor, state } = setup('<p>one</p><p>two</p>');
    state.enabled = true;
    // Enter splits the block: a SplitStep cannot be expressed as a mark, so it passes through
    editor.commands.focus('end');
    editor.commands.splitBlock();

    expect(editor.getHTML()).not.toContain('<ins');
    expect(editor.getHTML()).not.toContain('<del');
    expect(state.entries).toHaveLength(0);
    editor.destroy();
  });
});
