import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';

afterEach(() => vi.restoreAllMocks());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { EditorContextMenu, type EditorContextTarget } from './EditorContextMenu';

/** Editor stub that records chained command calls (covering only the commands the menu uses) */
function stubEditor(selection = { from: 0, to: 0 }) {
  const calls: string[] = [];
  const chain: Record<string, unknown> = {};
  for (const name of [
    'focus',
    'setTextSelection',
    'extendMarkRange',
    'setLink',
    'unsetLink',
    'toggleBold',
    'toggleItalic',
    'toggleUnderline',
    'toggleStrike',
    'toggleHighlight',
    'unsetAllMarks',
    'selectAll',
    'insertContent',
    'setNodeSelection',
    'deleteSelection',
  ]) {
    chain[name] = (...args: unknown[]) => {
      calls.push(`${name}(${args.map((arg) => JSON.stringify(arg)).join(',')})`);
      return chain;
    };
  }
  chain.run = () => {
    calls.push('run');
    return true;
  };
  const editor = {
    chain: () => chain,
    isActive: () => false,
    state: {
      selection,
      // Put an image node at position 5 to test the target check of "delete image"
      doc: { nodeAt: (pos: number) => (pos === 5 ? { type: { name: 'image' } } : null) },
    },
  } as unknown as Editor;
  return { editor, calls };
}

function setup(target: EditorContextTarget, selection = { from: 0, to: 0 }) {
  const { editor, calls } = stubEditor(selection);
  const onClose = vi.fn();
  render(<EditorContextMenu editor={editor} target={target} onClose={onClose} />);
  return { calls, onClose };
}

const linkTarget: EditorContextTarget = {
  x: 120,
  y: 160,
  kind: 'link',
  href: 'https://example.com/a',
};

describe('editor context menu', () => {
  it('offers open / edit / remove actions on a link', () => {
    setup(linkTarget, { from: 3, to: 12 });
    expect(screen.getByRole('menu')).toBeTruthy();
    for (const key of ['openLink', 'copyLink', 'editLink', 'removeLink']) {
      expect(screen.getByRole('menuitem', { name: `tools.richText.${key}` })).toBeTruthy();
    }
  });

  it('removes a link: unwraps the whole run and closes the menu', () => {
    const { calls, onClose } = setup(linkTarget, { from: 3, to: 12 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'tools.richText.removeLink' }));

    expect(onClose).toHaveBeenCalled();
    expect(calls).toContain('extendMarkRange("link")');
    expect(calls).toContain('unsetLink()');
  });

  it('edits a link: applies the new address to the link mark without re-selecting while typing', () => {
    const selectSpy = vi.spyOn(HTMLInputElement.prototype, 'select');
    const { calls, onClose } = setup(linkTarget, { from: 3, to: 12 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'tools.richText.editLink' }));

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('https://example.com/a');
    // Select everything once when entering the input state, so the old address can be overwritten
    expect(selectSpy).toHaveBeenCalledTimes(1);

    // Regression: no re-selecting while typing, or the next keystroke would replace everything typed
    fireEvent.change(input, { target: { value: 'https://example.org' } });
    fireEvent.change(input, { target: { value: 'https://example.org/b' } });
    expect(selectSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'tools.richText.apply' }));

    expect(calls).toContain('extendMarkRange("link")');
    expect(calls).toContain('setLink({"href":"https://example.org/b"})');
    expect(onClose).toHaveBeenCalled();
  });

  it('inserts a link: an empty value removes the link from the selected text', () => {
    const { calls } = setup({ x: 10, y: 10, kind: 'text' }, { from: 2, to: 6 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'tools.richText.insertLink' }));
    fireEvent.click(screen.getByRole('button', { name: 'tools.richText.apply' }));

    expect(calls).toContain('setTextSelection({"from":2,"to":6})');
    expect(calls).toContain('unsetLink()');
  });

  it('offers editing actions with a selection and only paste / select-all without one', () => {
    setup({ x: 10, y: 10, kind: 'text' }, { from: 2, to: 6 });
    expect(screen.getByRole('menuitem', { name: 'tools.richText.cut' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'common.copy' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'tools.richText.clearFormat' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'tools.richText.insertLink' })).toBeTruthy();
  });

  it('disables cut / copy and omits insert-link without a selection', () => {
    setup({ x: 10, y: 10, kind: 'empty' });
    expect(screen.getByRole('menuitem', { name: 'tools.richText.cut' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'common.copy' })).toBeDisabled();
    expect(screen.queryByRole('menuitem', { name: 'tools.richText.insertLink' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'tools.richText.selectAll' })).toBeTruthy();
  });

  it('offers delete on images and only deletes nodes that still point at an image', () => {
    const { calls } = setup({ x: 10, y: 10, kind: 'image', imagePos: 5 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'tools.richText.deleteImage' }));
    expect(calls).toContain('setNodeSelection(5)');
    expect(calls).toContain('deleteSelection()');
  });
});
