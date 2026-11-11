import { describe, expect, it } from 'vitest';
import {
  BODY_STYLE_ID,
  buildStyleCss,
  createDefaultStyles,
  currentStyleId,
  inlineNamedStyles,
  nextCustomStyleId,
  removeStyle,
  resetStyle,
  resolveStyle,
  sanitizeStyles,
  styleDeclarations,
  upsertStyle,
  type NamedStyle,
} from './namedStyles';

/**
 * Named style set (P1-1): inheritance, CSS generation, export inlining and draft validation.
 * The set is plain data, so every rule here is a pure function — the editor integration is covered by
 * the e2e case in `e2e/office-styles.spec.ts`.
 */

const defaults = createDefaultStyles();

describe('default style set', () => {
  it('ships the nine gallery presets with body text first', () => {
    expect(defaults).toHaveLength(9);
    expect(defaults[0]?.id).toBe(BODY_STYLE_ID);
    expect(defaults.map((style) => style.id)).toEqual([
      'body',
      'title',
      'heading2',
      'heading3',
      'heading4',
      'heading5',
      'heading6',
      'quote',
      'code',
    ]);
  });

  it('gives every heading style a level so the TOC and .docx can use it', () => {
    expect(defaults.find((style) => style.id === 'title')?.headingLevel).toBe(1);
    expect(defaults.find((style) => style.id === 'heading6')?.headingLevel).toBe(6);
    expect(defaults.find((style) => style.id === BODY_STYLE_ID)?.headingLevel).toBeUndefined();
  });

  it('marks the shipped styles as built-in, so they can be edited but not deleted', () => {
    expect(defaults.every((style) => style.builtin === true)).toBe(true);
  });
});

describe('inheritance (basedOn)', () => {
  const custom: NamedStyle[] = [
    ...defaults,
    { id: 'note', name: '提示', basedOn: 'heading2', font: { color: '#b45309' } },
  ];

  it('merges the parent chain, child last', () => {
    const resolved = resolveStyle(custom, 'note');
    expect(resolved?.font).toEqual({ size: 16, bold: true, color: '#b45309' });
  });

  it('resolves the body style through its own chain', () => {
    expect(resolveStyle(custom, 'heading3')?.font?.size).toBe(14);
    expect(resolveStyle(custom, 'heading3')?.font?.bold).toBe(true);
  });

  it('stops on a cycle instead of looping forever', () => {
    const cyclic: NamedStyle[] = [
      { id: 'body', font: { size: 11 } },
      { id: 'a', basedOn: 'b', font: { bold: true } },
      { id: 'b', basedOn: 'a', font: { italic: true } },
    ];
    // Both members are walked once and the loop stops: the merged result is bounded, not infinite
    expect(resolveStyle(cyclic, 'a')?.font).toEqual({ bold: true, italic: true });
    expect(resolveStyle(cyclic, 'body')?.font).toEqual({ size: 11 });
  });

  it('ignores an unknown parent', () => {
    const orphan: NamedStyle[] = [{ id: 'x', basedOn: 'missing', font: { size: 12 } }];
    expect(resolveStyle(orphan, 'x')?.font?.size).toBe(12);
  });

  it('returns undefined for an unknown id', () => {
    expect(resolveStyle(defaults, 'nope')).toBeUndefined();
  });
});

describe('CSS generation', () => {
  it('writes one scoped rule per style with pt sizes', () => {
    const css = buildStyleCss(defaults);
    expect(css).toContain('.tiptap [data-rte-style="title"] { font-size: 22pt; font-weight: 700 }');
    // Two selectors: the surface-scoped one outranks `.rte-surface .tiptap h1` (0,3,0 > 0,2,1)
    expect(css).toContain('.rte-surface .tiptap [data-rte-style="title"]');
    expect(css.split('\n')).toHaveLength(9);
  });

  it('includes the inherited declarations of a child style', () => {
    const styles: NamedStyle[] = [
      { id: 'body', font: { size: 11 } },
      { id: 'lead', basedOn: 'body', font: { size: 13, italic: true } },
    ];
    expect(buildStyleCss(styles)).toBe(
      '.rte-surface .tiptap [data-rte-style="body"], .tiptap [data-rte-style="body"] { font-size: 11pt }\n' +
        '.rte-surface .tiptap [data-rte-style="lead"], .tiptap [data-rte-style="lead"] { font-size: 13pt; font-style: italic }',
    );
  });

  it('skips styles that declare nothing', () => {
    expect(buildStyleCss([{ id: 'empty' }])).toBe('');
    expect(styleDeclarations({ id: 'empty' })).toBe('');
  });
});

describe('export inlining', () => {
  it('expands data-rte-style into inline CSS for surfaces without our stylesheet', () => {
    const html = '<h1 data-rte-style="title">标题</h1><p>正文</p>';
    const result = inlineNamedStyles(html, defaults);
    expect(result).toContain(
      '<h1 data-rte-style="title" style="font-size: 22pt; font-weight: 700">',
    );
    expect(result).toContain('<p>正文</p>');
  });

  it('keeps explicit inline declarations winning over the style', () => {
    const html = '<p data-rte-style="quote" style="color: #ff0000">引用</p>';
    expect(inlineNamedStyles(html, defaults)).toContain(
      'style="font-size: 11pt; font-style: italic; color: #6b7280; color: #ff0000"',
    );
  });

  it('leaves markup without styles or unknown ids untouched', () => {
    expect(inlineNamedStyles('<p>正文</p>', defaults)).toBe('<p>正文</p>');
    expect(inlineNamedStyles('<p data-rte-style="ghost">x</p>', defaults)).toContain(
      '<p data-rte-style="ghost">x</p>',
    );
    expect(inlineNamedStyles('<p data-rte-style="title">x</p>', [])).toBe(
      '<p data-rte-style="title">x</p>',
    );
  });
});

describe('editing the set', () => {
  it('upserts in place, keeping document order, and appends new styles', () => {
    const renamed = upsertStyle(defaults, { ...(defaults[1] as NamedStyle), name: '大标题' });
    expect(renamed).toHaveLength(9);
    expect(renamed[1]?.name).toBe('大标题');
    const added = upsertStyle(defaults, { id: 'custom-1', name: '提示' });
    expect(added.at(-1)?.id).toBe('custom-1');
  });

  it('refuses to delete a built-in style', () => {
    expect(removeStyle(defaults, 'title')).toHaveLength(9);
  });

  it('re-parents orphans to body text when their parent is deleted', () => {
    const styles: NamedStyle[] = [...defaults, { id: 'custom-1', name: '提示' }];
    const child = upsertStyle(styles, { id: 'custom-2', name: '子样式', basedOn: 'custom-1' });
    const next = removeStyle(child, 'custom-1');
    expect(next.map((style) => style.id)).not.toContain('custom-1');
    expect(next.find((style) => style.id === 'custom-2')?.basedOn).toBe(BODY_STYLE_ID);
  });

  it('resets a built-in style to its shipped values but keeps the user name', () => {
    const edited = upsertStyle(defaults, {
      ...(defaults[1] as NamedStyle),
      name: '我的标题',
      font: { size: 30 },
    });
    const reset = resetStyle(edited, 'title');
    const title = reset.find((style) => style.id === 'title');
    expect(title?.font).toEqual({ size: 22, bold: true });
    expect(title?.name).toBe('我的标题');
  });

  it('allocates the first free custom id', () => {
    expect(nextCustomStyleId(defaults)).toBe('custom-1');
    expect(nextCustomStyleId([...defaults, { id: 'custom-1' }])).toBe('custom-2');
  });
});

describe('draft validation', () => {
  it('falls back to the shipped set for anything that is not an array', () => {
    expect(sanitizeStyles(undefined)).toHaveLength(9);
    expect(sanitizeStyles({ styles: [] })).toHaveLength(9);
  });

  it('drops malformed entries field by field', () => {
    const next = sanitizeStyles([
      { id: 'Title', name: '  大标题  ', font: { size: 30, color: '#FF0000', bold: true } },
      { id: 'bad id!' },
      { id: 'Title' },
      { id: 'no-size', font: { size: 500 } },
      { id: 'no-color', font: { color: 'red' } },
      'nonsense',
    ]);
    const title = next.find((style) => style.id === 'title');
    expect(title?.name).toBe('大标题');
    expect(title?.font).toEqual({ size: 30, bold: true, color: '#ff0000' });
    // Duplicates collapse, invalid ids disappear, out-of-range values are dropped not clamped
    expect(next.filter((style) => style.id === 'title')).toHaveLength(1);
    expect(next.map((style) => style.id)).not.toContain('bad id!');
    expect(next.find((style) => style.id === 'no-size')?.font).toBeUndefined();
    expect(next.find((style) => style.id === 'no-color')?.font).toBeUndefined();
  });

  it('always gives the document a body style', () => {
    const next = sanitizeStyles([{ id: 'custom-1', name: '提示' }]);
    expect(next[0]?.id).toBe(BODY_STYLE_ID);
    expect(next.map((style) => style.id)).toContain('custom-1');
  });

  it('drops a self-referencing basedOn', () => {
    expect(sanitizeStyles([{ id: 'loop', basedOn: 'loop' }])[1]?.basedOn).toBeUndefined();
  });
});

describe('caret style resolution', () => {
  const fakeEditor = (name: string, attrs: Record<string, unknown>) =>
    ({
      state: { selection: { $from: { parent: { type: { name }, attrs } } } },
    }) as unknown as Parameters<typeof currentStyleId>[0];

  it('prefers the block attribute', () => {
    expect(currentStyleId(fakeEditor('heading', { level: 2, styleId: 'custom-1' }))).toBe(
      'custom-1',
    );
  });

  it('falls back to the block kind, then to body text', () => {
    expect(currentStyleId(fakeEditor('blockquote', {}))).toBe('quote');
    expect(currentStyleId(fakeEditor('codeBlock', {}))).toBe('code');
    expect(currentStyleId(fakeEditor('heading', { level: 1 }))).toBe('title');
    expect(currentStyleId(fakeEditor('heading', { level: 3 }))).toBe('heading3');
    expect(currentStyleId(fakeEditor('paragraph', {}))).toBe(BODY_STYLE_ID);
  });
});
