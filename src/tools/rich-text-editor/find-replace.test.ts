import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createExtensions } from './extensions';
import { findMatches, findReplaceKey } from './find-replace';
import { DEFAULT_PAGE_SETUP, resolvePageMetrics } from './pageSetup';

/** Find & replace (implementation plan P0-5.2): matching, navigation, replacement and decorations. */

let editor: Editor | null = null;

function makeEditor(content: string): Editor {
  const created = new Editor({
    element: document.createElement('div'),
    extensions: createExtensions({
      placeholder: '输入内容…',
      onLayout: () => {},
      getPageMetrics: () => resolvePageMetrics(DEFAULT_PAGE_SETUP),
    }),
    content,
  });
  editor = created;
  return created;
}

const text = (instance: Editor): string =>
  instance.state.doc.textBetween(0, instance.state.doc.content.size, '\n');

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('findMatches', () => {
  it('matches case-insensitively by default and exactly when requested', () => {
    const instance = makeEditor('<p>Foo foo FOO</p>');
    expect(findMatches(instance.state.doc, 'foo', false)).toHaveLength(3);
    expect(findMatches(instance.state.doc, 'foo', true)).toHaveLength(1);
  });

  it('reports every non-overlapping occurrence with document positions', () => {
    const instance = makeEditor('<p>aaaa</p>');
    expect(findMatches(instance.state.doc, 'aa', false)).toEqual([
      { from: 1, to: 3 },
      { from: 3, to: 5 },
    ]);
  });

  it('never matches across text nodes, matching mainstream editors', () => {
    const instance = makeEditor('<p>he<strong>llo</strong></p>');
    expect(findMatches(instance.state.doc, 'hello', false)).toEqual([]);
    expect(findMatches(instance.state.doc, 'llo', false)).toHaveLength(1);
  });

  it('returns nothing for an empty term', () => {
    const instance = makeEditor('<p>anything</p>');
    expect(findMatches(instance.state.doc, '', false)).toEqual([]);
  });
});

describe('find & replace commands', () => {
  it('highlights every match and marks the current one', () => {
    const instance = makeEditor('<p>foo foo foo</p>');
    instance.commands.setSearch('foo', false);

    expect(findReplaceKey.getState(instance.state)?.index).toBe(0);
    expect(instance.view.dom.querySelectorAll('.rte-find-match')).toHaveLength(2);
    expect(instance.view.dom.querySelectorAll('.rte-find-current')).toHaveLength(1);
  });

  it('cycles through matches in both directions', () => {
    const instance = makeEditor('<p>foo foo foo</p>');
    instance.commands.setSearch('foo', false);
    const index = () => findReplaceKey.getState(instance.state)?.index;

    instance.commands.gotoMatch(1);
    expect(index()).toBe(1);
    instance.commands.gotoMatch(1);
    expect(index()).toBe(2);
    // Wraps forward to the first match and backward from the first to the last
    instance.commands.gotoMatch(1);
    expect(index()).toBe(0);
    instance.commands.gotoMatch(-1);
    expect(index()).toBe(2);
  });

  it('replaces only the current match', () => {
    const instance = makeEditor('<p>foo foo</p>');
    instance.commands.setSearch('foo', false);
    instance.commands.gotoMatch(1);
    instance.commands.replaceMatch('bar');

    expect(text(instance)).toBe('foo bar');
  });

  it('replaces all matches back to front so earlier positions stay valid', () => {
    const instance = makeEditor('<p>foo bar foo foo</p>');
    instance.commands.setSearch('foo', false);

    expect(instance.commands.replaceAllMatches('baz')).toBe(true);
    expect(text(instance)).toBe('baz bar baz baz');
  });

  it('deletes all matches when the replacement is empty', () => {
    const instance = makeEditor('<p>a foo b foo c</p>');
    instance.commands.setSearch(' foo', false);
    instance.commands.replaceAllMatches('');

    expect(text(instance)).toBe('a b c');
  });

  it('keeps the current index inside the remaining match count after an edit', () => {
    const instance = makeEditor('<p>foo foo foo</p>');
    instance.commands.setSearch('foo', false);
    instance.commands.gotoMatch(1);
    instance.commands.gotoMatch(1);
    expect(findReplaceKey.getState(instance.state)?.index).toBe(2);

    // Replacing the last match leaves two, so the stored index must be clamped instead of dangling
    instance.commands.replaceMatch('bar');
    expect(findReplaceKey.getState(instance.state)?.index).toBe(1);
    expect(findMatches(instance.state.doc, 'foo', false)).toHaveLength(2);
  });

  it('caches the match list in plugin state so decoration queries do not rescan the document', () => {
    const instance = makeEditor('<p>foo bar foo</p>');
    instance.commands.setSearch('foo', false);
    // P1-5: decorations read this cache; a missing/empty cache would silently drop the highlights
    expect(findReplaceKey.getState(instance.state)?.matches).toEqual(
      findMatches(instance.state.doc, 'foo', false),
    );

    instance.commands.replaceAllMatches('baz');
    // The pre-replace list must not survive: the new document has no matches left
    expect(findReplaceKey.getState(instance.state)?.matches).toEqual([]);
  });

  it('clears the search state when the term is emptied', () => {
    const instance = makeEditor('<p>foo</p>');
    instance.commands.setSearch('foo', false);
    instance.commands.setSearch('', false);

    expect(findReplaceKey.getState(instance.state)).toBeNull();
    expect(instance.view.dom.querySelectorAll('.rte-find-match')).toHaveLength(0);
  });
});
