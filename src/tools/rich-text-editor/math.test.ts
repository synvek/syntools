import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createExtensions } from './extensions';
import { collectLatex, injectMath } from './math';

/**
 * Formula tests:
 * - The node stores only LaTeX source (atom); the NodeView renders the preview with KaTeX;
 * - Before export injectMath renders the source into MathML so single-file HTML needs no external stylesheet;
 * - Serialized output must parse back into formula nodes.
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
});

describe('formula node commands', () => {
  it('serializes an inserted inline formula with data-latex and data-display', () => {
    const editor = createEditor('<p>正文</p>');
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertInlineMath('\\frac{a}{b}');
    const html = editor.getHTML();
    expect(html).toContain('data-math="inline"');
    expect(html).toContain('data-latex="\\frac{a}{b}"');
    expect(html).toContain('data-display="false"');
  });

  it('inserts a block formula as its own block node', () => {
    const editor = createEditor('<p>正文</p>');
    editor.commands.insertBlockMath('\\sum_{i=1}^{n} a_i');
    const html = editor.getHTML();
    expect(html).toContain('<div');
    expect(html).toContain('data-display="true"');
    expect(collectLatex(editor.state.doc)).toEqual(['\\sum_{i=1}^{n} a_i']);
  });

  it('re-parses the serialized output as formula nodes', () => {
    const editor = createEditor(
      '<p>前<span data-math="inline" data-latex="x^2" data-display="false"></span>后</p>' +
        '<div data-math="block" data-latex="y_i" data-display="true"></div>',
    );
    expect(collectLatex(editor.state.doc)).toEqual(['x^2', 'y_i']);
  });

  it('updateMath / removeMath act on the formula at a position', () => {
    const editor = createEditor('<p>正文</p>');
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertInlineMath('a');
    const pos = editor.state.selection.from - 1;
    expect(editor.state.doc.nodeAt(pos)?.type.name).toBe('mathInline');
    expect(editor.commands.updateMath(pos, 'a^2')).toBe(true);
    expect(collectLatex(editor.state.doc)).toEqual(['a^2']);
    expect(editor.commands.removeMath(pos)).toBe(true);
    expect(collectLatex(editor.state.doc)).toEqual([]);
  });

  it('returns false when the command targets a non-formula position', () => {
    const editor = createEditor('<p>正文</p>');
    expect(editor.commands.updateMath(0, 'x')).toBe(false);
    expect(editor.commands.removeMath(0)).toBe(false);
  });

  it('the NodeView renders the preview with KaTeX and falls back to source on failure', () => {
    const editor = createEditor('<p>正文</p>');
    editor.commands.insertBlockMath('\\frac{a}{b}');
    expect(editor.view.dom.querySelector('.rte-math .katex')).not.toBeNull();

    // A syntax error shows the source with an error flag instead of KaTeX's red error output
    editor.commands.insertBlockMath('\\undefinedcmd{x}');
    const failed = Array.from(editor.view.dom.querySelectorAll('.rte-math-error'));
    expect(failed.length).toBe(1);
    expect(failed[0].textContent).toContain('\\undefinedcmd{x}');
  });
});

describe('injectMath', () => {
  it('renders formula LaTeX into MathML and keeps data-latex', () => {
    const html = injectMath(
      '<p>前<span data-math="inline" data-latex="x^2" data-display="false"></span>后</p>',
    );
    expect(html).toContain('<math');
    expect(html).toContain('data-latex="x^2"');
    expect(html).toContain('前');
    expect(html).toContain('后');
  });

  it('renders block formulas in display mode', () => {
    const html = injectMath(
      '<div data-math="block" data-display="true" data-latex="\\sum_{i=1}^{n} a_i"></div>',
    );
    expect(html).toContain('<math');
    expect(html).toContain('display="block"');
  });

  it('returns the input unchanged when there are no formulas', () => {
    const html = '<p>只有正文</p>';
    expect(injectMath(html)).toBe(html);
  });

  it('keeps the node and source when LaTeX is empty or rendering fails, losing nothing', () => {
    const empty = injectMath('<span data-math="inline" data-latex=""></span>');
    expect(empty).toContain('data-latex=""');

    const broken = injectMath('<span data-math="inline" data-latex="\\undefinedcmd{x}"></span>');
    expect(broken).toContain('$\\undefinedcmd{x}$');
  });
});
