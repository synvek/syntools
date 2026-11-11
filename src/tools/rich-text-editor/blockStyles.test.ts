import { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';
import { CONTENT_WIDTH_PX } from './core';
import { createExtensions } from './extensions';

/**
 * Image node serialization tests:
 * 1) Regression guard: ImageStyle overriding addAttributes must merge the parent, or src is lost and the image disappears;
 * 2) Layer and float offsets (offsetX/offsetY) must survive an HTML round trip.
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

/** Absolute position of the first image: inline images sit inside a paragraph, so pos 0 is no longer safe to assume */
function imagePos(editor: Editor): number {
  let pos = -1;
  editor.state.doc.descendants((node, offset) => {
    if (pos < 0 && node.type.name === 'image') pos = offset;
    return true;
  });
  return pos;
}

describe('ImageStyle attribute inheritance', () => {
  it('keeps the parent src/alt/title instead of rendering an empty img without src', () => {
    const editor = createEditor('<p>文字</p>');
    editor.commands.setImage({ src: 'data:image/png;base64,iVBORw0KGgo=', alt: '样图' });
    const html = editor.getHTML();
    expect(html).toContain('<img');
    expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(html).toContain('alt="样图"');
  });

  it('inserted image nodes really carry a src attribute', () => {
    const editor = createEditor('<p></p>');
    editor.commands.setImage({ src: 'data:image/png;base64,AAAA' });
    let src: unknown = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') src = node.attrs.src;
    });
    expect(src).toBe('data:image/png;base64,AAAA');
  });
});

describe('image width (pixel semantics)', () => {
  it('resizes a selected inline image (NodeSelection), which used to fail by only looking at the paragraph parent', () => {
    const editor = createEditor('<img src="data:image/png;base64,AAAA">');
    editor.commands.setNodeSelection(imagePos(editor));
    expect(editor.commands.setImageWidth(320)).toBe(true);
    expect(editor.getHTML()).toContain('width: 320px');
  });

  it('setImageStyle writes both width and alignment', () => {
    const editor = createEditor('<img src="data:image/png;base64,AAAA">');
    editor.commands.setNodeSelection(imagePos(editor));
    expect(editor.commands.setImageStyle(200, 'center')).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain('width: 200px');
    expect(html).toContain('data-align="center"');
  });

  it('returns false when no image is selected, so nothing else changes', () => {
    const editor = createEditor('<p>只有文字</p>');
    editor.commands.setTextSelection(1);
    expect(editor.commands.setImageWidth(200)).toBe(false);
  });

  it('treats a null width as auto-size and emits no width style', () => {
    const editor = createEditor('<img src="data:image/png;base64,AAAA" style="width: 320px">');
    editor.commands.setNodeSelection(imagePos(editor));
    editor.commands.setImageWidth(null);
    const html = editor.getHTML();
    expect(html).not.toContain('width: 320px');
  });

  it('converts legacy percentage widths to pixels using the A4 content width', () => {
    const editor = createEditor('<img src="data:image/png;base64,AAAA" style="width: 50%">');
    let width: unknown = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') width = node.attrs.width;
    });
    expect(width).toBe(Math.round(0.5 * CONTENT_WIDTH_PX));
  });

  it('keeps the image selected after a resize so it can be adjusted repeatedly; inline node selections used to collapse to a cursor', () => {
    const editor = createEditor('<p>前<img src="data:image/png;base64,AAAA">后</p>');
    editor.commands.setNodeSelection(imagePos(editor));
    editor.commands.setImageWidth(200);
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);

    // Setting alignment right after proves the selection is still on the same image
    expect(editor.commands.setImageStyle(120, 'center')).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain('width: 120px');
    expect(html).toContain('data-align="center"');
  });
});

describe('inline images (inline nodes)', () => {
  it('puts image and text in the same paragraph instead of its own line', () => {
    const editor = createEditor('<p>前<img src="data:image/png;base64,AAAA">后</p>');
    const html = editor.getHTML();
    expect(html).toContain('前<img');
    expect(html).toContain('>后</p>');
    expect(html.match(/<p/g)?.length).toBe(1);
  });

  it('inserts the image between characters at the cursor', () => {
    const editor = createEditor('<p>前文后</p>');
    editor.commands.setTextSelection(3);
    editor.commands.setImage({ src: 'data:image/png;base64,AAAA' });
    const html = editor.getHTML();
    expect(html).toContain('前文<img');
    expect(html).toContain('>后</p>');
    expect(html.match(/<p/g)?.length).toBe(1);
  });

  it('wraps a top-level <img> from an old document into a paragraph without losing content', () => {
    const editor = createEditor('<p>甲</p><img src="data:image/png;base64,AAAA"><p>乙</p>');
    const html = editor.getHTML();
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html.match(/<p/g)?.length).toBe(3);
  });
});

describe('image layer and float offset', () => {
  it('inline images emit no layer attributes (default style, flows with text)', () => {
    const editor = createEditor('<img src="data:image/png;base64,AAAA">');
    const html = editor.getHTML();
    expect(html).not.toContain('data-layer');
    expect(html).not.toContain('position: absolute');
  });

  it('in-front / behind-text images emit data-layer and absolute offsets', () => {
    const editor = createEditor('<img src="data:image/png;base64,AAAA">');
    editor.commands.setImageLayer('front');
    expect(editor.getHTML()).toContain('data-layer="front"');

    editor.commands.setImageLayer('behind');
    const html = editor.getHTML();
    expect(html).toContain('data-layer="behind"');
    expect(html).toContain('left:');
    expect(html).toContain('top:');
  });

  it('round-trips layer and offset through HTML (draft/import parity)', () => {
    const editor = createEditor(
      '<img src="data:image/png;base64,AAAA" data-layer="behind" style="left: 12px; top: 34px">',
    );
    let attrs: Record<string, unknown> | null = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') attrs = node.attrs;
    });
    expect(attrs).toMatchObject({ layer: 'behind', offsetX: 12, offsetY: 34 });
  });

  it('square / top-and-bottom wrapping writes data-layer without absolute offsets', () => {
    const editor = createEditor('<p>文字<img src="data:image/png;base64,AAAA"></p>');
    editor.commands.setNodeSelection(imagePos(editor));

    editor.commands.setImageLayer('wrap-left');
    let html = editor.getHTML();
    expect(html).toContain('data-layer="wrap-left"');
    expect(html).not.toContain('position: absolute');

    editor.commands.setImageLayer('top-bottom');
    html = editor.getHTML();
    expect(html).toContain('data-layer="top-bottom"');

    let attrs: Record<string, unknown> = {};
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') attrs = node.attrs;
    });
    expect(attrs.layer).toBe('top-bottom');
    expect(attrs.offsetX).toBeNull();
  });

  it('round-trips the wrap mode through HTML (draft parity)', () => {
    const editor = createEditor(
      '<p>文字<img src="data:image/png;base64,AAAA" data-layer="wrap-right"></p>',
    );
    let layer: unknown = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') layer = node.attrs.layer;
    });
    expect(layer).toBe('wrap-right');
  });

  it('falls back to inline for an unknown data-layer value', () => {
    const editor = createEditor(
      '<p>文字<img src="data:image/png;base64,AAAA" data-layer="nonsense"></p>',
    );
    let layer: unknown = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') layer = node.attrs.layer;
    });
    expect(layer).toBe('inline');
  });

  it('keeps the image selected after a layer switch so it can be switched again', () => {
    const editor = createEditor('<p>文字<img src="data:image/png;base64,AAAA"></p>');
    editor.commands.setNodeSelection(imagePos(editor));
    editor.commands.setImageLayer('front');
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(editor.commands.setImageLayer('inline')).toBe(true);
  });

  it('clears float positioning when switching back to inline, leaving no absolute styles behind', () => {
    const editor = createEditor(
      '<img src="data:image/png;base64,AAAA" data-layer="front" style="left: 12px; top: 34px">',
    );
    editor.commands.setImageLayer('inline');
    const html = editor.getHTML();
    expect(html).not.toContain('data-layer');
    expect(html).not.toContain('left:');
  });
});

/** Text position inside the first cell of the given kind (cell offset + 2 lands in its paragraph) */
function firstCellTextPos(editor: Editor, type: 'tableCell' | 'tableHeader' = 'tableCell'): number {
  let pos = -1;
  editor.state.doc.descendants((node, offset) => {
    if (pos < 0 && node.type.name === type) pos = offset;
    return pos < 0;
  });
  return pos + 2;
}

const TABLE_HTML = [
  '<table><tbody>',
  '<tr><th>表头</th><th>表头2</th></tr>',
  '<tr><td>甲</td><td>乙</td></tr>',
  '</tbody></table>',
].join('');

describe('table cell vertical alignment', () => {
  it('writes data-valign on the cell holding the caret and clears it again', () => {
    const editor = createEditor(TABLE_HTML);
    editor.commands.setTextSelection(firstCellTextPos(editor));
    expect(editor.commands.setCellVerticalAlign('middle')).toBe(true);
    const cells = editor.getHTML().match(/<td[^>]*>/g) ?? [];
    expect(cells.filter((cell) => cell.includes('data-valign="middle"'))).toHaveLength(1);

    expect(editor.commands.setCellVerticalAlign(null)).toBe(true);
    expect(editor.getHTML()).not.toContain('data-valign');
  });

  it('also aligns header cells, which are a separate node type', () => {
    const editor = createEditor(TABLE_HTML);
    editor.commands.setTextSelection(firstCellTextPos(editor, 'tableHeader'));
    expect(editor.commands.setCellVerticalAlign('bottom')).toBe(true);
    const headers = editor.getHTML().match(/<th[^>]*>/g) ?? [];
    expect(headers.filter((cell) => cell.includes('data-valign="bottom"'))).toHaveLength(1);
  });

  it('reads an inline vertical-align style and re-renders it as the data attribute', () => {
    const editor = createEditor(
      '<table><tr><td style="vertical-align: middle">x</td></tr></table>',
    );
    let align: unknown = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'tableCell') align = node.attrs.verticalAlign;
    });
    expect(align).toBe('middle');
    expect(editor.getHTML()).toContain('data-valign="middle"');
  });

  it('returns false outside a table so unrelated content is untouched', () => {
    const editor = createEditor('<p>只有文字</p>');
    editor.commands.setTextSelection(1);
    expect(editor.commands.setCellVerticalAlign('middle')).toBe(false);
  });
});

describe('table row height', () => {
  it('sets the height of the row holding the caret only', () => {
    const editor = createEditor(TABLE_HTML);
    editor.commands.setTextSelection(firstCellTextPos(editor));
    expect(editor.commands.setRowHeight(40)).toBe(true);
    const rows = editor.getHTML().match(/<tr[^>]*>/g) ?? [];
    expect(rows.filter((row) => row.includes('height: 40px'))).toHaveLength(1);
  });

  it('round-trips a height written by an import or a draft', () => {
    const editor = createEditor('<table><tr style="height: 64px"><td>x</td></tr></table>');
    let height: unknown = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'tableRow') height = node.attrs.height;
    });
    expect(height).toBe(64);
    expect(editor.getHTML()).toContain('height: 64px');
  });

  it('restores auto height with null and leaves no style behind', () => {
    const editor = createEditor('<table><tr style="height: 64px"><td>x</td></tr></table>');
    editor.commands.setTextSelection(firstCellTextPos(editor));
    expect(editor.commands.setRowHeight(null)).toBe(true);
    expect(editor.getHTML()).not.toContain('height:');
  });

  it('returns false outside a table', () => {
    const editor = createEditor('<p>只有文字</p>');
    editor.commands.setTextSelection(1);
    expect(editor.commands.setRowHeight(40)).toBe(false);
  });
});

describe('paragraph pagination (P1-4)', () => {
  it('round-trips the three flags as data attributes', () => {
    const editor = createEditor(
      '<p data-keep-next="true" data-keep-lines="true" data-widow-control="off">段落</p>',
    );
    const attrs = editor.getAttributes('paragraph');
    expect(attrs.keepNext).toBe(true);
    expect(attrs.keepLines).toBe(true);
    // Only the "off" state is stored: on is the document default
    expect(attrs.widowControl).toBe(false);
    const html = editor.getHTML();
    expect(html).toContain('data-keep-next="true"');
    expect(html).toContain('data-keep-lines="true"');
    expect(html).toContain('data-widow-control="off"');
  });

  it('toggles one flag without clearing the others', () => {
    const editor = createEditor('<p data-keep-next="true">段落</p>');
    editor.commands.setTextSelection(2);
    editor.commands.setParagraphPagination({ keepLines: true });
    expect(editor.getAttributes('paragraph')).toMatchObject({ keepNext: true, keepLines: true });
    editor.commands.setParagraphPagination({ keepNext: null });
    expect(editor.getAttributes('paragraph')).toMatchObject({ keepNext: null, keepLines: true });
  });

  it('drops the attribute once the flag is cleared', () => {
    const editor = createEditor('<p data-keep-lines="true">段落</p>');
    editor.commands.setTextSelection(2);
    editor.commands.setParagraphPagination({ keepLines: null });
    expect(editor.getHTML()).not.toContain('data-keep-lines');
  });
});
