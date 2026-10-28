import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it } from 'vitest';
import { charFormatExtensions } from './charFormat';

/** Character-level formatting marks: HTML round-trip (document save/load) and command exclusivity */

const editors: Editor[] = [];

function createEditor(content: string): Editor {
  const editor = new Editor({ extensions: [StarterKit, ...charFormatExtensions], content });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  while (editors.length > 0) editors.pop()?.destroy();
});

describe('charFormat marks: HTML parsing', () => {
  it('keeps <sup> / <sub> tags on load', () => {
    const editor = createEditor('<p>E=mc<sup>2</sup> H<sub>2</sub>O</p>');
    const html = editor.getHTML();
    expect(html).toContain('<sup');
    expect(html).toContain('<sub');
  });

  it('keeps inline letter-spacing and text-transform on load', () => {
    const editor = createEditor(
      '<p><span style="letter-spacing: 1px">宽</span><span style="text-transform: uppercase">abc</span></p>',
    );
    const html = editor.getHTML();
    expect(html).toContain('letter-spacing: 1px');
    expect(html).toContain('text-transform: uppercase');
  });

  it('reads the stored values back as mark attributes', () => {
    const editor = createEditor('<p><span style="letter-spacing: 1.5px">a</span></p>');
    editor.commands.selectAll();
    expect(editor.getAttributes('letterSpacing').px).toBe(1.5);
  });
});

describe('charFormat commands', () => {
  it('toggles superscript on and off', () => {
    const editor = createEditor('<p>abc</p>');
    editor.commands.selectAll();
    editor.commands.toggleSuperscript();
    expect(editor.isActive('superscript')).toBe(true);
    expect(editor.getHTML()).toContain('<sup');
    editor.commands.toggleSuperscript();
    expect(editor.isActive('superscript')).toBe(false);
  });

  it('keeps superscript and subscript mutually exclusive', () => {
    const editor = createEditor('<p>abc</p>');
    editor.commands.selectAll();
    editor.commands.toggleSuperscript();
    editor.commands.toggleSubscript();
    expect(editor.isActive('subscript')).toBe(true);
    expect(editor.isActive('superscript')).toBe(false);
  });

  it('sets and clears letter spacing', () => {
    const editor = createEditor('<p>abc</p>');
    editor.commands.selectAll();
    editor.commands.setLetterSpacing(1);
    expect(editor.getHTML()).toContain('letter-spacing: 1px');
    editor.commands.setLetterSpacing(null);
    expect(editor.getHTML()).not.toContain('letter-spacing');
  });

  it('sets and clears text transform', () => {
    const editor = createEditor('<p>abc</p>');
    editor.commands.selectAll();
    editor.commands.setTextTransform('uppercase');
    expect(editor.getHTML()).toContain('text-transform: uppercase');
    editor.commands.setTextTransform(null);
    expect(editor.getHTML()).not.toContain('text-transform');
  });
});
