import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createExtensions } from './extensions';
import {
  addUserWord,
  buildSpellDecorations,
  checkText,
  collectDocIssues,
  createWordIndex,
  editDistance,
  isCheckableWord,
  loadDictionary,
  normalizeWord,
  removeUserWord,
  suggest,
  tokenize,
} from './spellcheck';

/**
 * Spellcheck tests (fully local, no network):
 * Token boundaries, edit-distance suggestions, the custom dictionary, and document-level decoration offsets.
 */

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
  vi.restoreAllMocks();
});

describe('tokenize / normalizeWord', () => {
  it('returns words with their offsets in the text', () => {
    const tokens = tokenize('the quick brown');
    expect(tokens.map((token) => [token.word, token.start, token.end])).toEqual([
      ['the', 0, 3],
      ['quick', 4, 9],
      ['brown', 10, 15],
    ]);
  });

  it('skips short words, URLs, and emails', () => {
    const tokens = tokenize('a be https://example.com/xx hello@example.com world');
    expect(tokens.map((token) => token.word)).toEqual(['world']);
  });

  it('lowercases and strips possessives', () => {
    expect(normalizeWord("Editor's")).toBe('editor');
    expect(normalizeWord('Word’s')).toBe('word');
    expect(normalizeWord('WORD')).toBe('word');
  });

  it('does not check camelCase identifiers', () => {
    expect(isCheckableWord('getElementById')).toBe(false);
    expect(isCheckableWord('hello')).toBe(true);
    expect(isCheckableWord('it')).toBe(false);
  });
});

describe('editDistance', () => {
  it('returns the actual edit distance', () => {
    expect(editDistance('kitten', 'sitting', 3)).toBe(3);
    expect(editDistance('word', 'word', 2)).toBe(0);
    expect(editDistance('word', 'words', 2)).toBe(1);
  });

  it('returns early with a larger value once the threshold is exceeded', () => {
    expect(editDistance('abcdef', 'zzzzzz', 1)).toBeGreaterThan(1);
    expect(editDistance('a', 'abcdefgh', 2)).toBeGreaterThan(2);
  });
});

describe('suggest', () => {
  const index = createWordIndex(['hello', 'help', 'helm', 'world', 'yellow']);

  it('prefers distance-1 candidates and sorts ties alphabetically', () => {
    // Alphabetical: hello < helm < help (4th character l < m < p)
    expect(suggest('helo', index, 5)).toEqual(['hello', 'helm', 'help']);
  });

  it('respects the limit and excludes the original word', () => {
    expect(suggest('help', index, 2)).toHaveLength(2);
    expect(suggest('help', index, 5)).not.toContain('help');
  });

  it('returns an empty array for an empty word list', () => {
    expect(suggest('helo', createWordIndex([]), 5)).toEqual([]);
  });

  it('includes custom dictionary words as candidates', () => {
    expect(suggest('syntol', createWordIndex([]), 5, ['syntools'])).toEqual(['syntools']);
  });
});

describe('checkText', () => {
  const dictionary = { words: new Set(['hello', 'world', 'quick', 'brown']), userWords: [] };

  it('reports only words missing from the dictionary', () => {
    const issues = checkText('hello wrold', dictionary);
    expect(issues.map((issue) => issue.word)).toEqual(['wrold']);
    expect(issues[0].start).toBe(6);
  });

  it('treats the custom dictionary as known words', () => {
    expect(checkText('syntools', { ...dictionary, userWords: ['syntools'] })).toEqual([]);
  });

  it('does not flag all-caps abbreviations', () => {
    expect(checkText('HTTP API', dictionary)).toEqual([]);
  });

  it('returns no results for empty text', () => {
    expect(checkText('', dictionary)).toEqual([]);
  });
});

describe('custom dictionary', () => {
  it('dedupes and normalizes on add', () => {
    expect(addUserWord([], "Alpha's")).toEqual(['alpha']);
    expect(addUserWord(['alpha'], 'alpha')).toEqual(['alpha']);
    expect(addUserWord(['alpha'], '  ')).toEqual(['alpha']);
  });

  it('compares normalized values on remove', () => {
    expect(removeUserWord(['alpha', 'beta'], "Alpha's")).toEqual(['beta']);
  });
});

describe('loadDictionary', () => {
  it('parses a plain-text word list (already decoded by the server)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('hello\nworld\n\nHELLO\n', { status: 200 })),
    );
    const result = await loadDictionary('test-words.txt');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.value]).toEqual(['hello', 'world']);
  });

  it('returns an error instead of throwing when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );
    expect(await loadDictionary('missing.txt')).toEqual({ ok: false, error: 'DICT_LOAD_FAILED' });
  });

  it('treats empty content as a load failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('\n\n', { status: 200 })),
    );
    expect(await loadDictionary('empty.txt')).toEqual({ ok: false, error: 'DICT_LOAD_FAILED' });
  });
});

describe('document-level decorations and issue list', () => {
  const dictionary = { words: new Set(['hello', 'world', 'and']), userWords: [] };

  it('decorates misspelled words with offsets matching the text', () => {
    const editor = createEditor('<p>hello wrold</p>');
    const deco = buildSpellDecorations(editor.state.doc, dictionary);
    const found = deco.find();
    expect(found).toHaveLength(1);
    // Paragraph starts at offset 1, plus 6 characters of 'hello '
    expect(found[0].from).toBe(1 + 6);
    expect(found[0].to).toBe(1 + 11);
    // CSS matches the decoration class name (Decoration does not expose attrs, so read the internals here)
    const spec = found[0] as unknown as { type: { attrs: { class?: string } } };
    expect(spec.type.attrs.class).toBe('rte-spell-error');
  });

  it('collectDocIssues returns issues with document positions and respects the cap', () => {
    const editor = createEditor('<p>hello wrold and anther</p>');
    const issues = collectDocIssues(editor.state.doc, dictionary);
    expect(issues.map((issue) => issue.word)).toEqual(['wrold', 'anther']);
    expect(issues[0].from).toBeLessThan(issues[1].from);
    expect(collectDocIssues(editor.state.doc, dictionary, 1)).toHaveLength(1);
  });

  it('produces no decorations or issues when every word is known', () => {
    const editor = createEditor('<p>hello world</p>');
    expect(buildSpellDecorations(editor.state.doc, dictionary).find()).toHaveLength(0);
    expect(collectDocIssues(editor.state.doc, dictionary)).toEqual([]);
  });
});
